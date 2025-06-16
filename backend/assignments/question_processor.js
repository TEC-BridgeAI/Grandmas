/**
 * GRANDMAS - Question Processor
 * 
 * This module provides serverless functions for processing different question types.
 */

const AWS = require('aws-sdk');
const { Pool } = require('pg');
const multer = require('multer');
const multerS3 = require('multer-s3');

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

// Configure S3
const s3 = new AWS.S3();

/**
 * Create a new question
 * 
 * @param {Object} event - Lambda event object
 * @returns {Object} - Response with question data or error
 */
exports.createQuestion = async (event) => {
  try {
    const { assignmentId, questionData } = JSON.parse(event.body);
    
    // Validate input
    if (!assignmentId || !questionData || !questionData.type || !questionData.content) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing required fields' })
      };
    }
    
    // Get question type ID
    const typeResult = await pool.query(
      'SELECT type_id FROM question_types WHERE name = $1',
      [questionData.type]
    );
    
    if (typeResult.rows.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Invalid question type' })
      };
    }
    
    const typeId = typeResult.rows[0].type_id;
    
    // Get max order number for this assignment
    const orderResult = await pool.query(
      'SELECT MAX(order_num) as max_order FROM questions WHERE assignment_id = $1',
      [assignmentId]
    );
    
    const orderNum = orderResult.rows[0].max_order ? orderResult.rows[0].max_order + 1 : 1;
    
    // Process question data based on type
    const processedData = processQuestionData(questionData);
    
    // Insert question
    const result = await pool.query(
      `INSERT INTO questions 
       (assignment_id, type_id, content, points, options, correct_answer, rubric, metadata, order_num, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING question_id`,
      [
        assignmentId,
        typeId,
        questionData.content,
        questionData.points || 1,
        processedData.options || null,
        processedData.correctAnswer || null,
        questionData.rubric || null,
        questionData.metadata || null,
        orderNum,
        questionData.createdBy
      ]
    );
    
    const questionId = result.rows[0].question_id;
    
    return {
      statusCode: 201,
      body: JSON.stringify({
        message: 'Question created successfully',
        questionId
      })
    };
  } catch (error) {
    console.error('Error in createQuestion:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error' })
    };
  }
};

/**
 * Process question data based on type
 * 
 * @param {Object} questionData - Question data
 * @returns {Object} - Processed question data
 */
function processQuestionData(questionData) {
  const { type } = questionData;
  let options = null;
  let correctAnswer = null;
  
  switch (type) {
    case 'true_false':
      correctAnswer = questionData.correctAnswer === true || questionData.correctAnswer === 'true';
      break;
      
    case 'multiple_choice':
      options = questionData.options || [];
      correctAnswer = questionData.correctAnswer;
      break;
      
    case 'multiple_answer':
      options = questionData.options || [];
      correctAnswer = Array.isArray(questionData.correctAnswer) ? questionData.correctAnswer : [];
      break;
      
    case 'matching':
      options = {
        left: questionData.options?.left || [],
        right: questionData.options?.right || []
      };
      correctAnswer = questionData.correctAnswer || {};
      break;
      
    case 'fill_in_blank':
      // Extract blanks from content
      const blankMatches = questionData.content.match(/\{\{blank-[0-9]+\}\}/g) || [];
      const blanks = blankMatches.map((match, index) => {
        const id = match.replace(/\{\{blank-([0-9]+)\}\}/, '$1');
        return { id, width: questionData.options?.blanks?.[index]?.width || 100 };
      });
      
      options = { blanks };
      correctAnswer = questionData.correctAnswer || {};
      break;
      
    case 'computational':
      options = questionData.options || {};
      correctAnswer = questionData.correctAnswer;
      break;
      
    case 'diagram':
      options = questionData.options || {};
      // For diagram questions, correct answer might be a reference image or criteria
      correctAnswer = questionData.correctAnswer || null;
      break;
      
    case 'drag_drop':
      options = { items: questionData.options?.items || [] };
      correctAnswer = questionData.correctAnswer || [];
      break;
      
    case 'coding':
      options = {
        language: questionData.options?.language || 'javascript',
        starterCode: questionData.options?.starterCode || '',
        testCases: questionData.options?.testCases || []
      };
      correctAnswer = questionData.correctAnswer || '';
      break;
      
    default:
      // For short_answer, essay, oral questions
      options = questionData.options || null;
      correctAnswer = questionData.correctAnswer || null;
  }
  
  return { options, correctAnswer };
}

/**
 * Submit a response to a question
 * 
 * @param {Object} event - Lambda event object
 * @returns {Object} - Response with success message or error
 */
exports.submitQuestionResponse = async (event) => {
  try {
    const { submissionId, questionId, responseData } = JSON.parse(event.body);
    
    // Validate input
    if (!submissionId || !questionId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Submission ID and question ID are required' })
      };
    }
    
    // Check if response already exists
    const existingResult = await pool.query(
      'SELECT response_id FROM question_responses WHERE submission_id = $1 AND question_id = $2',
      [submissionId, questionId]
    );
    
    if (existingResult.rows.length > 0) {
      // Update existing response
      await pool.query(
        `UPDATE question_responses
         SET response_data = $1
         WHERE submission_id = $2 AND question_id = $3`,
        [responseData, submissionId, questionId]
      );
    } else {
      // Insert new response
      await pool.query(
        `INSERT INTO question_responses
         (submission_id, question_id, response_data)
         VALUES ($1, $2, $3)`,
        [submissionId, questionId, responseData]
      );
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Response submitted successfully' })
    };
  } catch (error) {
    console.error('Error in submitQuestionResponse:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error' })
    };
  }
};

/**
 * Upload file for a question response
 * 
 * @param {Object} event - Lambda event object
 * @returns {Object} - Response with file URL or error
 */
exports.uploadResponseFile = async (event) => {
  try {
    // Configure S3 upload
    const upload = multer({
      storage: multerS3({
        s3,
        bucket: process.env.S3_BUCKET,
        metadata: (req, file, cb) => {
          cb(null, { fieldName: file.fieldname });
        },
        key: (req, file, cb) => {
          const submissionId = req.body.submissionId;
          const questionId = req.body.questionId;
          const fileName = `submissions/${submissionId}/question_${questionId}/${Date.now()}_${file.originalname}`;
          cb(null, fileName);
        }
      })
    });
    
    // Process upload
    const singleUpload = upload.single('file');
    
    return new Promise((resolve, reject) => {
      singleUpload(event, {}, async (err) => {
        if (err) {
          console.error('Error uploading file:', err);
          return resolve({
            statusCode: 500,
            body: JSON.stringify({ message: 'Error uploading file' })
          });
        }
        
        try {
          const { submissionId, questionId } = event.body;
          const file = event.file;
          
          // Save file reference in database
          await pool.query(
            `INSERT INTO files
             (filename, file_path, file_size, file_type, uploaded_by, entity_type, entity_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              file.originalname,
              file.location,
              file.size,
              file.mimetype,
              event.requestContext.authorizer.claims.sub,
              'question_response',
              questionId
            ]
          );
          
          // Update or insert question response with file reference
          const existingResult = await pool.query(
            'SELECT response_id FROM question_responses WHERE submission_id = $1 AND question_id = $2',
            [submissionId, questionId]
          );
          
          if (existingResult.rows.length > 0) {
            await pool.query(
              `UPDATE question_responses
               SET response_data = jsonb_set(response_data, '{fileUrl}', $1)
               WHERE submission_id = $2 AND question_id = $3`,
              [JSON.stringify(file.location), submissionId, questionId]
            );
          } else {
            await pool.query(
              `INSERT INTO question_responses
               (submission_id, question_id, response_data)
               VALUES ($1, $2, $3)`,
              [submissionId, questionId, { fileUrl: file.location }]
            );
          }
          
          return resolve({
            statusCode: 200,
            body: JSON.stringify({
              message: 'File uploaded successfully',
              fileUrl: file.location
            })
          });
        } catch (error) {
          console.error('Error processing file upload:', error);
          return resolve({
            statusCode: 500,
            body: JSON.stringify({ message: 'Error processing file upload' })
          });
        }
      });
    });
  } catch (error) {
    console.error('Error in uploadResponseFile:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error' })
    };
  }
};

/**
 * Get questions for an assignment
 * 
 * @param {Object} event - Lambda event object
 * @returns {Object} - Response with questions or error
 */
exports.getAssignmentQuestions = async (event) => {
  try {
    const assignmentId = event.pathParameters.assignmentId;
    
    // Get questions
    const result = await pool.query(
      `SELECT q.question_id, q.content, q.points, q.options, q.rubric, q.metadata, q.order_num,
              qt.name as type
       FROM questions q
       JOIN question_types qt ON q.type_id = qt.type_id
       WHERE q.assignment_id = $1
       ORDER BY q.order_num`,
      [assignmentId]
    );
    
    return {
      statusCode: 200,
      body: JSON.stringify(result.rows)
    };
  } catch (error) {
    console.error('Error in getAssignmentQuestions:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error' })
    };
  }
};

/**
 * Get student responses for an assignment
 * 
 * @param {Object} event - Lambda event object
 * @returns {Object} - Response with responses or error
 */
exports.getStudentResponses = async (event) => {
  try {
    const { submissionId } = event.pathParameters;
    
    // Get responses
    const result = await pool.query(
      `SELECT qr.response_id, qr.question_id, qr.response_data, qr.score, qr.feedback,
              q.content as question_content, q.points as question_points,
              qt.name as question_type
       FROM question_responses qr
       JOIN questions q ON qr.question_id = q.question_id
       JOIN question_types qt ON q.type_id = qt.type_id
       WHERE qr.submission_id = $1`,
      [submissionId]
    );
    
    return {
      statusCode: 200,
      body: JSON.stringify(result.rows)
    };
  } catch (error) {
    console.error('Error in getStudentResponses:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error' })
    };
  }
};