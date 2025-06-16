# GRANDMAS System Architecture

## System Components

### 1. Frontend Layer
- **Web Interface**: React.js application
- **Mobile Interface**: React Native application
- **Features**:
  - User authentication
  - Course management
  - Assignment creation and submission
  - Grading interface
  - Reports and analytics

### 2. API Layer
- **API Gateway**: RESTful endpoints for all system functions
- **Authentication**: JWT-based authentication with Amazon Cognito

### 3. Serverless Functions Layer
- **User Management**: User registration, authentication, and role management
- **Course Management**: Course creation, enrollment, and management
- **Assignment Engine**: Creating, distributing, and collecting assignments
- **Grading Engine**: Automated grading for various question types
- **Reporting Engine**: Grade calculation and report generation
- **Admin Functions**: System management and configuration

### 4. Data Layer
- **Aurora PostgreSQL**: Primary database for structured data
- **Amazon S3**: Storage for files, assignments, and submissions
- **ElastiCache**: Caching for performance optimization

## Data Flow

1. **User Authentication Flow**:
   - User logs in through web/mobile interface
   - Authentication request sent to Cognito
   - JWT token returned and stored for subsequent requests

2. **Assignment Creation Flow**:
   - Teacher creates assignment with various question types
   - Assignment data stored in PostgreSQL
   - Files stored in S3
   - Assignment made available to enrolled students

3. **Assignment Submission Flow**:
   - Student completes assignment
   - Submission stored in PostgreSQL and S3
   - Notification sent to teacher

4. **Grading Flow**:
   - Automated grading for objective questions (T/F, multiple choice, etc.)
   - Manual grading interface for subjective questions (essays, etc.)
   - Grades stored in PostgreSQL
   - Notifications sent to students

5. **Reporting Flow**:
   - Grade calculations performed on-demand
   - Reports generated and delivered to users
   - Analytics provided to teachers and administrators

## Question Type Handling

| Question Type | Input Method | Grading Method |
|---------------|--------------|---------------|
| True/False | Radio buttons | Automated comparison |
| Multiple Choice | Radio buttons | Automated comparison |
| Matching | Drag-and-drop interface | Automated comparison |
| Short Answer | Text input | NLP-based comparison or manual |
| Essay | Rich text editor | Manual with rubric assistance |
| Fill-in-the-blank | Text input | Pattern matching or exact match |
| Computational | Formula input or file upload | Result comparison |
| Diagram-based | Canvas drawing or file upload | Manual or image recognition |
| Drag-and-drop | Interactive UI elements | Automated position checking |
| Programming/Coding | Code editor or file upload | Test case execution |
| Oral Questions | Audio recording | Manual or speech recognition |