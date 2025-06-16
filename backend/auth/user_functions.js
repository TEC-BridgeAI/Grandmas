/**
 * GRANDMAS - User Authentication and Management Functions
 * 
 * This module provides serverless functions for user authentication and management.
 */

const AWS = require('aws-sdk');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

// Configure PostgreSQL connection
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false
  }
});

/**
 * Register a new user
 * 
 * @param {Object} event - Lambda event object
 * @returns {Object} - Response with user data or error
 */
exports.registerUser = async (event) => {
  try {
    const { username, password, email, role, profileData } = JSON.parse(event.body);
    
    // Validate input
    if (!username || !password || !email || !role) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing required fields' })
      };
    }
    
    // Check if role is valid
    if (!['student', 'teacher', 'admin'].includes(role)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Invalid role' })
      };
    }
    
    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // Begin transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Insert user
      const userResult = await client.query(
        `INSERT INTO users (username, password_hash, email, role) 
         VALUES ($1, $2, $3, $4) RETURNING user_id`,
        [username, passwordHash, email, role]
      );
      
      const userId = userResult.rows[0].user_id;
      
      // Create profile based on role
      if (role === 'student') {
        await createStudentProfile(client, userId, profileData);
      } else if (role === 'teacher') {
        await createTeacherProfile(client, userId, profileData);
      }
      
      // Log the action
      await logUserAction(client, userId, 'user_registration');
      
      await client.query('COMMIT');
      
      return {
        statusCode: 201,
        body: JSON.stringify({ 
          message: 'User registered successfully',
          userId
        })
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error registering user:', error);
      
      if (error.code === '23505') { // Unique violation
        return {
          statusCode: 409,
          body: JSON.stringify({ message: 'Username or email already exists' })
        };
      }
      
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error in registerUser:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error' })
    };
  }
};

/**
 * Login user
 * 
 * @param {Object} event - Lambda event object
 * @returns {Object} - Response with JWT token or error
 */
exports.login = async (event) => {
  try {
    const { username, password } = JSON.parse(event.body);
    
    // Validate input
    if (!username || !password) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Username and password are required' })
      };
    }
    
    // Get user from database
    const result = await pool.query(
      'SELECT user_id, username, password_hash, role FROM users WHERE username = $1 AND is_active = TRUE',
      [username]
    );
    
    if (result.rows.length === 0) {
      return {
        statusCode: 401,
        body: JSON.stringify({ message: 'Invalid credentials' })
      };
    }
    
    const user = result.rows[0];
    
    // Compare password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isPasswordValid) {
      return {
        statusCode: 401,
        body: JSON.stringify({ message: 'Invalid credentials' })
      };
    }
    
    // Update last login time
    await pool.query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = $1',
      [user.user_id]
    );
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.user_id,
        username: user.username,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // Log the action
    await logUserAction(null, user.user_id, 'user_login');
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        token,
        user: {
          userId: user.user_id,
          username: user.username,
          role: user.role
        }
      })
    };
  } catch (error) {
    console.error('Error in login:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error' })
    };
  }
};

/**
 * Assign role to user
 * 
 * @param {Object} event - Lambda event object
 * @returns {Object} - Response with success message or error
 */
exports.assignRole = async (event) => {
  try {
    const { userId, role } = JSON.parse(event.body);
    
    // Validate input
    if (!userId || !role) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'User ID and role are required' })
      };
    }
    
    // Check if role is valid
    if (!['student', 'teacher', 'admin'].includes(role)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Invalid role' })
      };
    }
    
    // Update user role
    const result = await pool.query(
      'UPDATE users SET role = $1 WHERE user_id = $2 RETURNING user_id',
      [role, userId]
    );
    
    if (result.rows.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'User not found' })
      };
    }
    
    // Log the action
    await logUserAction(null, userId, 'role_change', { newRole: role });
    
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Role assigned successfully' })
    };
  } catch (error) {
    console.error('Error in assignRole:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error' })
    };
  }
};

/**
 * Create student profile
 * 
 * @param {Object} client - Database client
 * @param {number} userId - User ID
 * @param {Object} profileData - Student profile data
 * @returns {Object} - Created student profile
 */
async function createStudentProfile(client, userId, profileData) {
  const {
    firstName,
    lastName,
    studentNumber,
    gradeLevel,
    dateOfBirth,
    contactInfo,
    additionalInfo
  } = profileData;
  
  const result = await client.query(
    `INSERT INTO student_profiles 
     (user_id, first_name, last_name, student_number, grade_level, date_of_birth, contact_info, additional_info)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING student_id`,
    [
      userId,
      firstName,
      lastName,
      studentNumber,
      gradeLevel,
      dateOfBirth,
      contactInfo || {},
      additionalInfo || {}
    ]
  );
  
  return result.rows[0];
}

/**
 * Create teacher profile
 * 
 * @param {Object} client - Database client
 * @param {number} userId - User ID
 * @param {Object} profileData - Teacher profile data
 * @returns {Object} - Created teacher profile
 */
async function createTeacherProfile(client, userId, profileData) {
  const {
    firstName,
    lastName,
    employeeId,
    department,
    contactInfo,
    qualifications,
    additionalInfo
  } = profileData;
  
  const result = await client.query(
    `INSERT INTO teacher_profiles 
     (user_id, first_name, last_name, employee_id, department, contact_info, qualifications, additional_info)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING teacher_id`,
    [
      userId,
      firstName,
      lastName,
      employeeId,
      department,
      contactInfo || {},
      qualifications || {},
      additionalInfo || {}
    ]
  );
  
  return result.rows[0];
}

/**
 * Log user action
 * 
 * @param {Object} client - Database client (optional)
 * @param {number} userId - User ID
 * @param {string} actionType - Type of action
 * @param {Object} details - Additional details (optional)
 */
async function logUserAction(client, userId, actionType, details = {}) {
  const query = `
    INSERT INTO audit_logs (user_id, action_type, details)
    VALUES ($1, $2, $3)
  `;
  
  if (client) {
    await client.query(query, [userId, actionType, details]);
  } else {
    await pool.query(query, [userId, actionType, details]);
  }
}

/**
 * Get user profile
 * 
 * @param {Object} event - Lambda event object
 * @returns {Object} - Response with user profile or error
 */
exports.getUserProfile = async (event) => {
  try {
    const userId = event.pathParameters.userId;
    
    // Get user from database
    const userResult = await pool.query(
      'SELECT user_id, username, email, role FROM users WHERE user_id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'User not found' })
      };
    }
    
    const user = userResult.rows[0];
    let profile = null;
    
    // Get profile based on role
    if (user.role === 'student') {
      const profileResult = await pool.query(
        'SELECT * FROM student_profiles WHERE user_id = $1',
        [userId]
      );
      if (profileResult.rows.length > 0) {
        profile = profileResult.rows[0];
      }
    } else if (user.role === 'teacher') {
      const profileResult = await pool.query(
        'SELECT * FROM teacher_profiles WHERE user_id = $1',
        [userId]
      );
      if (profileResult.rows.length > 0) {
        profile = profileResult.rows[0];
      }
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        user,
        profile
      })
    };
  } catch (error) {
    console.error('Error in getUserProfile:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error' })
    };
  }
};

/**
 * Update user profile
 * 
 * @param {Object} event - Lambda event object
 * @returns {Object} - Response with success message or error
 */
exports.updateProfile = async (event) => {
  try {
    const userId = event.pathParameters.userId;
    const { profileData } = JSON.parse(event.body);
    
    // Get user role
    const userResult = await pool.query(
      'SELECT role FROM users WHERE user_id = $1',
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'User not found' })
      };
    }
    
    const role = userResult.rows[0].role;
    
    // Update profile based on role
    if (role === 'student') {
      await updateStudentProfile(userId, profileData);
    } else if (role === 'teacher') {
      await updateTeacherProfile(userId, profileData);
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Profile update not supported for this role' })
      };
    }
    
    // Log the action
    await logUserAction(null, userId, 'profile_update');
    
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Profile updated successfully' })
    };
  } catch (error) {
    console.error('Error in updateProfile:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error' })
    };
  }
};

/**
 * Update student profile
 * 
 * @param {number} userId - User ID
 * @param {Object} profileData - Student profile data
 */
async function updateStudentProfile(userId, profileData) {
  const {
    firstName,
    lastName,
    studentNumber,
    gradeLevel,
    dateOfBirth,
    contactInfo,
    additionalInfo
  } = profileData;
  
  await pool.query(
    `UPDATE student_profiles 
     SET first_name = $1, last_name = $2, student_number = $3, 
         grade_level = $4, date_of_birth = $5, contact_info = $6, additional_info = $7
     WHERE user_id = $8`,
    [
      firstName,
      lastName,
      studentNumber,
      gradeLevel,
      dateOfBirth,
      contactInfo || {},
      additionalInfo || {},
      userId
    ]
  );
}

/**
 * Update teacher profile
 * 
 * @param {number} userId - User ID
 * @param {Object} profileData - Teacher profile data
 */
async function updateTeacherProfile(userId, profileData) {
  const {
    firstName,
    lastName,
    employeeId,
    department,
    contactInfo,
    qualifications,
    additionalInfo
  } = profileData;
  
  await pool.query(
    `UPDATE teacher_profiles 
     SET first_name = $1, last_name = $2, employee_id = $3, 
         department = $4, contact_info = $5, qualifications = $6, additional_info = $7
     WHERE user_id = $8`,
    [
      firstName,
      lastName,
      employeeId,
      department,
      contactInfo || {},
      qualifications || {},
      additionalInfo || {},
      userId
    ]
  );
}