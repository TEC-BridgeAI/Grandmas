-- GRANDMAS Database Schema

-- Users table
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

-- Student profiles
CREATE TABLE student_profiles (
    student_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    student_number VARCHAR(20) UNIQUE,
    grade_level VARCHAR(20),
    date_of_birth DATE,
    contact_info JSONB,
    additional_info JSONB
);

-- Teacher profiles
CREATE TABLE teacher_profiles (
    teacher_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    employee_id VARCHAR(20) UNIQUE,
    department VARCHAR(50),
    contact_info JSONB,
    qualifications JSONB,
    additional_info JSONB
);

-- Courses
CREATE TABLE courses (
    course_id SERIAL PRIMARY KEY,
    course_code VARCHAR(20) UNIQUE NOT NULL,
    title VARCHAR(100) NOT NULL,
    description TEXT,
    credit_hours INTEGER,
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(user_id)
);

-- Course-Teacher relationship
CREATE TABLE course_teachers (
    course_id INTEGER REFERENCES courses(course_id) ON DELETE CASCADE,
    teacher_id INTEGER REFERENCES teacher_profiles(teacher_id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'primary', -- primary, assistant, guest, etc.
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (course_id, teacher_id)
);

-- Course-Student relationship (enrollments)
CREATE TABLE enrollments (
    enrollment_id SERIAL PRIMARY KEY,
    course_id INTEGER REFERENCES courses(course_id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES student_profiles(student_id) ON DELETE CASCADE,
    enrollment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'dropped', 'completed')),
    final_grade DECIMAL(5,2),
    UNIQUE (course_id, student_id)
);

-- Assignment categories
CREATE TABLE assignment_categories (
    category_id SERIAL PRIMARY KEY,
    course_id INTEGER REFERENCES courses(course_id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    weight DECIMAL(5,2) NOT NULL, -- percentage weight in final grade
    description TEXT,
    UNIQUE (course_id, name)
);

-- Assignments
CREATE TABLE assignments (
    assignment_id SERIAL PRIMARY KEY,
    course_id INTEGER REFERENCES courses(course_id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES assignment_categories(category_id),
    title VARCHAR(100) NOT NULL,
    description TEXT,
    total_points INTEGER NOT NULL,
    due_date TIMESTAMP,
    available_from TIMESTAMP,
    available_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(user_id),
    is_published BOOLEAN DEFAULT FALSE
);

-- Question types
CREATE TABLE question_types (
    type_id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    grading_method VARCHAR(20) NOT NULL CHECK (grading_method IN ('automatic', 'manual', 'hybrid'))
);

-- Insert standard question types
INSERT INTO question_types (name, description, grading_method) VALUES
('true_false', 'True or False questions', 'automatic'),
('multiple_choice', 'Multiple choice questions with single correct answer', 'automatic'),
('multiple_answer', 'Multiple choice questions with multiple correct answers', 'automatic'),
('matching', 'Matching items from two columns', 'automatic'),
('short_answer', 'Brief text responses', 'hybrid'),
('essay', 'Extended text responses', 'manual'),
('fill_in_blank', 'Text with missing words to be filled in', 'hybrid'),
('computational', 'Mathematical or scientific calculations', 'hybrid'),
('diagram', 'Drawing or labeling diagrams', 'manual'),
('drag_drop', 'Arranging items by dragging and dropping', 'automatic'),
('coding', 'Programming or coding questions', 'hybrid'),
('oral', 'Spoken responses', 'manual');

-- Questions
CREATE TABLE questions (
    question_id SERIAL PRIMARY KEY,
    assignment_id INTEGER REFERENCES assignments(assignment_id) ON DELETE CASCADE,
    type_id INTEGER REFERENCES question_types(type_id),
    content TEXT NOT NULL,
    points INTEGER NOT NULL,
    options JSONB, -- For multiple choice, matching, etc.
    correct_answer JSONB, -- Stored in format appropriate for question type
    rubric JSONB, -- For manual grading
    metadata JSONB, -- Additional question-specific data
    order_num INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(user_id)
);

-- Student submissions
CREATE TABLE submissions (
    submission_id SERIAL PRIMARY KEY,
    assignment_id INTEGER REFERENCES assignments(assignment_id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES student_profiles(student_id) ON DELETE CASCADE,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'late', 'graded')),
    total_score DECIMAL(5,2),
    feedback TEXT,
    graded_at TIMESTAMP,
    graded_by INTEGER REFERENCES users(user_id),
    UNIQUE (assignment_id, student_id)
);

-- Question responses
CREATE TABLE question_responses (
    response_id SERIAL PRIMARY KEY,
    submission_id INTEGER REFERENCES submissions(submission_id) ON DELETE CASCADE,
    question_id INTEGER REFERENCES questions(question_id) ON DELETE CASCADE,
    response_data JSONB, -- Stores the student's answer in appropriate format
    score DECIMAL(5,2),
    feedback TEXT,
    graded_at TIMESTAMP,
    graded_by INTEGER REFERENCES users(user_id),
    UNIQUE (submission_id, question_id)
);

-- Files (for assignments, submissions, etc.)
CREATE TABLE files (
    file_id SERIAL PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(512) NOT NULL,
    file_size INTEGER,
    file_type VARCHAR(100),
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    uploaded_by INTEGER REFERENCES users(user_id),
    entity_type VARCHAR(50) NOT NULL, -- 'assignment', 'submission', 'question', 'response'
    entity_id INTEGER NOT NULL -- ID of the related entity
);

-- Audit logs
CREATE TABLE audit_logs (
    log_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id),
    action_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INTEGER,
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Grading scales
CREATE TABLE grading_scales (
    scale_id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    description TEXT,
    created_by INTEGER REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_default BOOLEAN DEFAULT FALSE
);

-- Grading scale thresholds
CREATE TABLE grading_scale_thresholds (
    threshold_id SERIAL PRIMARY KEY,
    scale_id INTEGER REFERENCES grading_scales(scale_id) ON DELETE CASCADE,
    grade VARCHAR(10) NOT NULL,
    min_score DECIMAL(5,2) NOT NULL,
    max_score DECIMAL(5,2) NOT NULL,
    UNIQUE (scale_id, grade)
);

-- Course grading scale relationship
CREATE TABLE course_grading_scales (
    course_id INTEGER REFERENCES courses(course_id) ON DELETE CASCADE,
    scale_id INTEGER REFERENCES grading_scales(scale_id) ON DELETE CASCADE,
    PRIMARY KEY (course_id, scale_id)
);

-- Indexes for performance
CREATE INDEX idx_enrollments_student ON enrollments(student_id);
CREATE INDEX idx_enrollments_course ON enrollments(course_id);
CREATE INDEX idx_assignments_course ON assignments(course_id);
CREATE INDEX idx_questions_assignment ON questions(assignment_id);
CREATE INDEX idx_submissions_assignment ON submissions(assignment_id);
CREATE INDEX idx_submissions_student ON submissions(student_id);
CREATE INDEX idx_question_responses_submission ON question_responses(submission_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);