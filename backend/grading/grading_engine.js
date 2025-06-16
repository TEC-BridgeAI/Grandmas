/**
 * GRANDMAS - Grading Engine
 * 
 * This module provides serverless functions for automated grading of various question types.
 */

const AWS = require('aws-sdk');
const { Pool } = require('pg');
const natural = require('natural');
const stringSimilarity = require('string-similarity');

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

// Initialize NLP tools
const tokenizer = new natural.WordTokenizer();
const stemmer = natural.PorterStemmer;

/**
 * Grade a submission
 * 
 * @param {Object} event - Lambda event object
 * @returns {Object} - Response with grading results or error
 */
exports.gradeSubmission = async (event) => {
  try {
    const { submissionId } = JSON.parse(event.body);
    
    // Validate input
    if (!submissionId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Submission ID is required' })
      };
    }
    
    // Get submission details
    const submissionResult = await pool.query(
      `SELECT s.submission_id, s.assignment_id, s.student_id, s.status,
              a.total_points
       FROM submissions s
       JOIN assignments a ON s.assignment_id = a.assignment_id
       WHERE s.submission_id = $1`,
      [submissionId]
    );
    
    if (submissionResult.rows.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Submission not found' })
      };
    }
    
    const submission = submissionResult.rows[0];
    
    // Check if submission is already graded
    if (submission.status === 'graded') {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Submission is already graded' })
      };
    }
    
    // Get all questions and responses for this submission
    const questionsResult = await pool.query(
      `SELECT q.question_id, q.type_id, q.content, q.points, q.correct_answer, q.options, q.rubric,
              qt.name as question_type, qt.grading_method,
              qr.response_id, qr.response_data
       FROM questions q
       JOIN question_types qt ON q.type_id = qt.type_id
       LEFT JOIN question_responses qr ON q.question_id = qr.question_id AND qr.submission_id = $1
       WHERE q.assignment_id = $2
       ORDER BY q.order_num`,
      [submissionId, submission.assignment_id]
    );
    
    const questions = questionsResult.rows;
    
    // Grade each question
    let totalScore = 0;
    const gradingResults = [];
    
    for (const question of questions) {
      // Skip if no response
      if (!question.response_id) {
        gradingResults.push({
          questionId: question.question_id,
          responseId: null,
          score: 0,
          feedback: 'No response provided',
          needsManualGrading: false
        });
        continue;
      }
      
      let score = 0;
      let feedback = '';
      let needsManualGrading = false;
      
      // Grade based on question type
      switch (question.question_type) {
        case 'true_false':
        case 'multiple_choice':
          ({ score, feedback } = gradeMultipleChoice(question));
          break;
          
        case 'multiple_answer':
          ({ score, feedback } = gradeMultipleAnswer(question));
          break;
          
        case 'matching':
          ({ score, feedback } = gradeMatching(question));
          break;
          
        case 'fill_in_blank':
          ({ score, feedback, needsManualGrading } = gradeFillInBlank(question));
          break;
          
        case 'short_answer':
          ({ score, feedback, needsManualGrading } = gradeShortAnswer(question));
          break;
          
        case 'computational':
          ({ score, feedback, needsManualGrading } = gradeComputational(question));
          break;
          
        case 'coding':
          ({ score, feedback, needsManualGrading } = gradeCoding(question));
          break;
          
        default:
          // Essay, diagram, oral questions need manual grading
          needsManualGrading = true;
          feedback = 'This question type requires manual grading';
      }
      
      // Update question response with score and feedback
      if (!needsManualGrading) {
        await pool.query(
          `UPDATE question_responses
           SET score = $1, feedback = $2, graded_at = CURRENT_TIMESTAMP
           WHERE response_id = $3`,
          [score, feedback, question.response_id]
        );
        
        totalScore += score;
      }
      
      gradingResults.push({
        questionId: question.question_id,
        responseId: question.response_id,
        score,
        feedback,
        needsManualGrading
      });
    }
    
    // Check if all questions are graded automatically
    const needsManualGrading = gradingResults.some(result => result.needsManualGrading);
    
    // Update submission status and score if fully graded
    if (!needsManualGrading) {
      await pool.query(
        `UPDATE submissions
         SET status = 'graded', total_score = $1, graded_at = CURRENT_TIMESTAMP
         WHERE submission_id = $2`,
        [totalScore, submissionId]
      );
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        submissionId,
        totalScore,
        maxPoints: submission.total_points,
        needsManualGrading,
        gradingResults
      })
    };
  } catch (error) {
    console.error('Error in gradeSubmission:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error' })
    };
  }
};

/**
 * Grade multiple choice question
 * 
 * @param {Object} question - Question object with response
 * @returns {Object} - Score and feedback
 */
function gradeMultipleChoice(question) {
  const correctAnswer = question.correct_answer;
  const studentAnswer = question.response_data;
  
  // Check if answer is correct
  const isCorrect = JSON.stringify(correctAnswer) === JSON.stringify(studentAnswer);
  
  const score = isCorrect ? question.points : 0;
  const feedback = isCorrect ? 'Correct answer' : 'Incorrect answer';
  
  return { score, feedback };
}

/**
 * Grade multiple answer question
 * 
 * @param {Object} question - Question object with response
 * @returns {Object} - Score and feedback
 */
function gradeMultipleAnswer(question) {
  const correctAnswers = question.correct_answer;
  const studentAnswers = question.response_data;
  
  if (!Array.isArray(correctAnswers) || !Array.isArray(studentAnswers)) {
    return { score: 0, feedback: 'Invalid answer format' };
  }
  
  // Count correct selections
  let correctSelections = 0;
  let incorrectSelections = 0;
  
  // Check selected answers
  for (const answer of studentAnswers) {
    if (correctAnswers.includes(answer)) {
      correctSelections++;
    } else {
      incorrectSelections++;
    }
  }
  
  // Check for missed correct answers
  const missedCorrect = correctAnswers.filter(answer => !studentAnswers.includes(answer)).length;
  
  // Calculate partial credit
  const totalOptions = question.options ? question.options.length : correctAnswers.length + 2;
  const totalDecisions = totalOptions; // One decision per option (select or not)
  const correctDecisions = totalOptions - incorrectSelections - missedCorrect;
  
  const score = Math.max(0, (correctDecisions / totalDecisions) * question.points);
  const roundedScore = Math.round(score * 100) / 100; // Round to 2 decimal places
  
  let feedback = '';
  if (correctSelections === correctAnswers.length && incorrectSelections === 0) {
    feedback = 'All correct options selected';
  } else if (incorrectSelections > 0 && missedCorrect > 0) {
    feedback = 'Some incorrect options selected and some correct options missed';
  } else if (incorrectSelections > 0) {
    feedback = 'Some incorrect options selected';
  } else if (missedCorrect > 0) {
    feedback = 'Some correct options missed';
  }
  
  return { score: roundedScore, feedback };
}

/**
 * Grade matching question
 * 
 * @param {Object} question - Question object with response
 * @returns {Object} - Score and feedback
 */
function gradeMatching(question) {
  const correctMatches = question.correct_answer;
  const studentMatches = question.response_data;
  
  if (!correctMatches || !studentMatches) {
    return { score: 0, feedback: 'Invalid answer format' };
  }
  
  // Count correct matches
  let correctCount = 0;
  const totalMatches = Object.keys(correctMatches).length;
  
  for (const [key, value] of Object.entries(studentMatches)) {
    if (correctMatches[key] === value) {
      correctCount++;
    }
  }
  
  // Calculate score
  const score = (correctCount / totalMatches) * question.points;
  const roundedScore = Math.round(score * 100) / 100; // Round to 2 decimal places
  
  const feedback = `${correctCount} out of ${totalMatches} matches correct`;
  
  return { score: roundedScore, feedback };
}

/**
 * Grade fill-in-the-blank question
 * 
 * @param {Object} question - Question object with response
 * @returns {Object} - Score, feedback, and manual grading flag
 */
function gradeFillInBlank(question) {
  const correctAnswers = question.correct_answer;
  const studentAnswers = question.response_data;
  
  if (!correctAnswers || !studentAnswers) {
    return { 
      score: 0, 
      feedback: 'Invalid answer format',
      needsManualGrading: false
    };
  }
  
  // Check if we need manual grading (based on metadata)
  const metadata = question.metadata || {};
  if (metadata.requiresManualGrading) {
    return {
      score: 0,
      feedback: 'This response requires manual grading',
      needsManualGrading: true
    };
  }
  
  // Count correct answers
  let correctCount = 0;
  const totalBlanks = Object.keys(correctAnswers).length;
  const incorrectAnswers = [];
  
  for (const [blankId, correctAnswer] of Object.entries(correctAnswers)) {
    const studentAnswer = studentAnswers[blankId];
    
    if (!studentAnswer) {
      incorrectAnswers.push(blankId);
      continue;
    }
    
    // Check for exact match or alternative answers
    if (Array.isArray(correctAnswer)) {
      // Multiple acceptable answers
      const isCorrect = correctAnswer.some(answer => 
        compareAnswers(studentAnswer, answer, metadata.caseSensitive)
      );
      
      if (isCorrect) {
        correctCount++;
      } else {
        incorrectAnswers.push(blankId);
      }
    } else {
      // Single correct answer
      const isCorrect = compareAnswers(studentAnswer, correctAnswer, metadata.caseSensitive);
      
      if (isCorrect) {
        correctCount++;
      } else {
        incorrectAnswers.push(blankId);
      }
    }
  }
  
  // Calculate score
  const score = (correctCount / totalBlanks) * question.points;
  const roundedScore = Math.round(score * 100) / 100; // Round to 2 decimal places
  
  let feedback = '';
  if (correctCount === totalBlanks) {
    feedback = 'All answers correct';
  } else if (correctCount === 0) {
    feedback = 'All answers incorrect';
  } else {
    feedback = `${correctCount} out of ${totalBlanks} answers correct`;
  }
  
  // Determine if manual review is needed
  const needsManualGrading = metadata.alwaysReview === true || 
                            (metadata.reviewThreshold && (correctCount / totalBlanks) < metadata.reviewThreshold);
  
  return { 
    score: roundedScore, 
    feedback,
    needsManualGrading
  };
}

/**
 * Grade short answer question
 * 
 * @param {Object} question - Question object with response
 * @returns {Object} - Score, feedback, and manual grading flag
 */
function gradeShortAnswer(question) {
  const correctAnswer = question.correct_answer;
  const studentAnswer = question.response_data;
  
  if (!correctAnswer || !studentAnswer) {
    return { 
      score: 0, 
      feedback: 'Invalid answer format',
      needsManualGrading: false
    };
  }
  
  // Check if we need manual grading
  const metadata = question.metadata || {};
  if (metadata.requiresManualGrading) {
    return {
      score: 0,
      feedback: 'This response requires manual grading',
      needsManualGrading: true
    };
  }
  
  // Use NLP to compare answers
  const similarity = calculateTextSimilarity(studentAnswer, correctAnswer);
  
  // Calculate score based on similarity threshold
  const threshold = metadata.similarityThreshold || 0.8;
  let score = 0;
  let feedback = '';
  let needsManualGrading = false;
  
  if (similarity >= threshold) {
    score = question.points;
    feedback = 'Answer matches expected response';
  } else if (similarity >= threshold * 0.7) {
    // Partial credit for close answers
    score = question.points * 0.5;
    feedback = 'Answer partially matches expected response';
    needsManualGrading = true; // Recommend manual review for partial matches
  } else {
    score = 0;
    feedback = 'Answer does not match expected response';
    needsManualGrading = true; // Recommend manual review for incorrect answers
  }
  
  return { 
    score, 
    feedback,
    needsManualGrading: needsManualGrading || metadata.alwaysReview === true
  };
}

/**
 * Grade computational question
 * 
 * @param {Object} question - Question object with response
 * @returns {Object} - Score, feedback, and manual grading flag
 */
function gradeComputational(question) {
  const correctAnswer = question.correct_answer;
  const studentAnswer = question.response_data;
  const metadata = question.metadata || {};
  
  if (!correctAnswer || !studentAnswer) {
    return { 
      score: 0, 
      feedback: 'Invalid answer format',
      needsManualGrading: false
    };
  }
  
  // Check if we need manual grading
  if (metadata.requiresManualGrading) {
    return {
      score: 0,
      feedback: 'This response requires manual grading',
      needsManualGrading: true
    };
  }
  
  // Handle different types of computational questions
  if (metadata.type === 'numeric') {
    // Numeric comparison with tolerance
    const tolerance = metadata.tolerance || 0;
    const isCorrect = Math.abs(parseFloat(studentAnswer) - parseFloat(correctAnswer)) <= tolerance;
    
    const score = isCorrect ? question.points : 0;
    const feedback = isCorrect ? 'Correct answer' : 'Incorrect answer';
    
    return { 
      score, 
      feedback,
      needsManualGrading: !isCorrect && metadata.reviewIncorrect === true
    };
  } else if (metadata.type === 'formula') {
    // Formula comparison requires manual grading
    return {
      score: 0,
      feedback: 'Formula evaluation requires manual grading',
      needsManualGrading: true
    };
  } else {
    // Default to manual grading for other computational types
    return {
      score: 0,
      feedback: 'This computational question requires manual grading',
      needsManualGrading: true
    };
  }
}

/**
 * Grade coding question
 * 
 * @param {Object} question - Question object with response
 * @returns {Object} - Score, feedback, and manual grading flag
 */
function gradeCoding(question) {
  // Coding questions typically need manual grading or test case execution
  // This is a simplified version that always requires manual grading
  
  return {
    score: 0,
    feedback: 'Code evaluation requires manual grading or test case execution',
    needsManualGrading: true
  };
}

/**
 * Compare student answer with correct answer
 * 
 * @param {string} studentAnswer - Student's answer
 * @param {string} correctAnswer - Correct answer
 * @param {boolean} caseSensitive - Whether comparison is case sensitive
 * @returns {boolean} - Whether answers match
 */
function compareAnswers(studentAnswer, correctAnswer, caseSensitive = false) {
  if (!caseSensitive) {
    studentAnswer = studentAnswer.toLowerCase();
    correctAnswer = correctAnswer.toLowerCase();
  }
  
  // Trim whitespace
  studentAnswer = studentAnswer.trim();
  correctAnswer = correctAnswer.trim();
  
  return studentAnswer === correctAnswer;
}

/**
 * Calculate text similarity between two strings
 * 
 * @param {string} text1 - First text
 * @param {string} text2 - Second text
 * @returns {number} - Similarity score (0-1)
 */
function calculateTextSimilarity(text1, text2) {
  // Tokenize and stem
  const tokens1 = tokenizer.tokenize(text1.toLowerCase()).map(token => stemmer.stem(token));
  const tokens2 = tokenizer.tokenize(text2.toLowerCase()).map(token => stemmer.stem(token));
  
  // Use string similarity for comparison
  return stringSimilarity.compareTwoStrings(tokens1.join(' '), tokens2.join(' '));
}

/**
 * Manual grade question
 * 
 * @param {Object} event - Lambda event object
 * @returns {Object} - Response with success message or error
 */
exports.manualGradeQuestion = async (event) => {
  try {
    const { responseId, score, feedback, graderId } = JSON.parse(event.body);
    
    // Validate input
    if (!responseId || score === undefined) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Response ID and score are required' })
      };
    }
    
    // Update question response
    await pool.query(
      `UPDATE question_responses
       SET score = $1, feedback = $2, graded_at = CURRENT_TIMESTAMP, graded_by = $3
       WHERE response_id = $4`,
      [score, feedback || '', graderId, responseId]
    );
    
    // Check if all questions in the submission are graded
    const submissionResult = await pool.query(
      `SELECT s.submission_id, s.assignment_id, s.student_id,
              COUNT(q.question_id) AS total_questions,
              COUNT(qr.score) AS graded_questions,
              SUM(qr.score) AS total_score
       FROM submissions s
       JOIN questions q ON s.assignment_id = q.assignment_id
       JOIN question_responses qr ON q.question_id = qr.question_id AND qr.submission_id = s.submission_id
       WHERE qr.response_id = $1
       GROUP BY s.submission_id, s.assignment_id, s.student_id`,
      [responseId]
    );
    
    if (submissionResult.rows.length > 0) {
      const submission = submissionResult.rows[0];
      
      // If all questions are graded, update submission status
      if (submission.total_questions === submission.graded_questions) {
        await pool.query(
          `UPDATE submissions
           SET status = 'graded', total_score = $1, graded_at = CURRENT_TIMESTAMP, graded_by = $2
           WHERE submission_id = $3`,
          [submission.total_score, graderId, submission.submission_id]
        );
      }
    }
    
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Question graded successfully' })
    };
  } catch (error) {
    console.error('Error in manualGradeQuestion:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error' })
    };
  }
};

/**
 * Calculate final grade for a student in a course
 * 
 * @param {Object} event - Lambda event object
 * @returns {Object} - Response with final grade or error
 */
exports.calculateFinalGrade = async (event) => {
  try {
    const { studentId, courseId } = JSON.parse(event.body);
    
    // Validate input
    if (!studentId || !courseId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Student ID and course ID are required' })
      };
    }
    
    // Get assignment categories and weights
    const categoriesResult = await pool.query(
      `SELECT category_id, name, weight
       FROM assignment_categories
       WHERE course_id = $1`,
      [courseId]
    );
    
    const categories = categoriesResult.rows;
    
    if (categories.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'No assignment categories found for this course' })
      };
    }
    
    // Calculate grade for each category
    let finalGrade = 0;
    const categoryGrades = [];
    
    for (const category of categories) {
      // Get assignments in this category
      const assignmentsResult = await pool.query(
        `SELECT a.assignment_id, a.title, a.total_points,
                s.total_score
         FROM assignments a
         LEFT JOIN submissions s ON a.assignment_id = s.assignment_id AND s.student_id = $1 AND s.status = 'graded'
         WHERE a.category_id = $2 AND a.is_published = TRUE`,
        [studentId, category.category_id]
      );
      
      const assignments = assignmentsResult.rows;
      
      if (assignments.length === 0) {
        categoryGrades.push({
          categoryId: category.category_id,
          name: category.name,
          weight: category.weight,
          percentage: 0,
          weightedScore: 0,
          assignments: []
        });
        continue;
      }
      
      // Calculate category percentage
      let totalPoints = 0;
      let earnedPoints = 0;
      const assignmentDetails = [];
      
      for (const assignment of assignments) {
        totalPoints += assignment.total_points;
        earnedPoints += assignment.total_score || 0;
        
        assignmentDetails.push({
          assignmentId: assignment.assignment_id,
          title: assignment.title,
          totalPoints: assignment.total_points,
          earnedPoints: assignment.total_score || 0,
          percentage: assignment.total_score ? (assignment.total_score / assignment.total_points) * 100 : 0
        });
      }
      
      const categoryPercentage = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
      const weightedScore = (categoryPercentage / 100) * category.weight;
      
      finalGrade += weightedScore;
      
      categoryGrades.push({
        categoryId: category.category_id,
        name: category.name,
        weight: category.weight,
        percentage: categoryPercentage,
        weightedScore,
        assignments: assignmentDetails
      });
    }
    
    // Get grading scale for the course
    const scaleResult = await pool.query(
      `SELECT gs.scale_id, gs.name, gst.grade, gst.min_score, gst.max_score
       FROM grading_scales gs
       JOIN course_grading_scales cgs ON gs.scale_id = cgs.scale_id
       JOIN grading_scale_thresholds gst ON gs.scale_id = gst.scale_id
       WHERE cgs.course_id = $1
       ORDER BY gst.min_score DESC`,
      [courseId]
    );
    
    let letterGrade = null;
    
    if (scaleResult.rows.length > 0) {
      const scale = scaleResult.rows;
      
      // Find letter grade based on final grade
      for (const threshold of scale) {
        if (finalGrade >= threshold.min_score && finalGrade <= threshold.max_score) {
          letterGrade = threshold.grade;
          break;
        }
      }
    }
    
    // Update enrollment record with final grade
    await pool.query(
      `UPDATE enrollments
       SET final_grade = $1
       WHERE student_id = $2 AND course_id = $3`,
      [finalGrade, studentId, courseId]
    );
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        studentId,
        courseId,
        finalGrade,
        letterGrade,
        categoryGrades
      })
    };
  } catch (error) {
    console.error('Error in calculateFinalGrade:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error' })
    };
  }
};