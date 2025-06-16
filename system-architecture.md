# GRANDMAS System Architecture Overview

## System Components

### 1. Frontend Layer
- **Web Interface**: React.js application with Material-UI components
- **Mobile Interface**: React Native application
- **Key Features**:
  - User authentication and profile management
  - Course management for teachers and administrators
  - Assignment creation with support for various question types
  - Student assignment submission interface
  - Grading interface for teachers
  - Reports and analytics dashboard

### 2. API Layer
- **API Gateway**: RESTful endpoints for all system functions
- **Authentication**: JWT-based authentication with Amazon Cognito
- **Key Endpoints**:
  - `/auth/*` - Authentication and user management
  - `/courses/*` - Course management
  - `/assignments/*` - Assignment creation and submission
  - `/submissions/*` - Student submissions
  - `/admin/*` - Administrative functions

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

## Question Type Handling

| Question Type | Input Method | Grading Method | Implementation |
|---------------|--------------|---------------|----------------|
| True/False | Radio buttons | Automated comparison | Simple boolean comparison |
| Multiple Choice | Radio buttons | Automated comparison | Direct value comparison |
| Multiple Answer | Checkboxes | Automated comparison with partial credit | Array comparison with scoring algorithm |
| Matching | Dropdown selectors | Automated comparison with partial credit | Object key-value comparison |
| Short Answer | Text input | NLP-based comparison or manual | Text similarity algorithm with threshold |
| Essay | Rich text editor | Manual with rubric assistance | Stored for manual review |
| Fill-in-the-blank | Text inputs | Pattern matching or exact match | String comparison with optional case sensitivity |
| Computational | Formula input or file upload | Result comparison | Numeric comparison with tolerance |
| Diagram-based | Canvas drawing or file upload | Manual or image recognition | File storage and manual review |
| Drag-and-drop | Interactive UI elements | Automated position checking | Array order comparison |
| Programming/Coding | Code editor or file upload | Test case execution | Stored for manual review or automated testing |
| Oral Questions | Audio recording | Manual or speech recognition | Audio file storage and manual review |

## Data Flow

### Assignment Creation Flow
1. Teacher creates assignment in web interface
2. Teacher adds questions of various types
3. Assignment data stored in PostgreSQL
4. Files stored in S3
5. Assignment made available to enrolled students

### Assignment Submission Flow
1. Student accesses assignment through web/mobile interface
2. Student completes questions of various types
3. Responses stored in PostgreSQL
4. Files uploaded to S3
5. Submission marked as complete

### Grading Flow
1. Automated grading engine processes objective questions
2. Teachers notified of submissions requiring manual grading
3. Teachers review and grade subjective questions
4. Final grades calculated and stored
5. Students notified of graded assignments

## Deployment Architecture

### AWS Services Used
- **Lambda**: Serverless functions for all backend logic
- **API Gateway**: RESTful API endpoints
- **Cognito**: User authentication and authorization
- **Aurora PostgreSQL**: Relational database
- **S3**: File storage
- **CloudFront**: Content delivery
- **Route 53**: DNS management
- **CloudWatch**: Monitoring and logging
- **IAM**: Security and access control

### Scaling Strategy
- Serverless architecture allows automatic scaling based on demand
- Database read replicas for high-traffic periods
- ElastiCache for reducing database load
- CloudFront for efficient content delivery

## Security Considerations

### Authentication and Authorization
- JWT-based authentication with Cognito
- Role-based access control (student, teacher, admin)
- Secure password policies
- MFA support for sensitive operations

### Data Protection
- Encryption at rest for all data
- Encryption in transit (HTTPS/TLS)
- S3 bucket policies for secure file access
- Database encryption

### Compliance
- FERPA compliance for educational data
- GDPR considerations for user privacy
- Regular security audits and penetration testing

## Monitoring and Maintenance

### Monitoring
- CloudWatch metrics and alarms
- API Gateway request logging
- Lambda function performance monitoring
- Database performance insights

### Backup and Recovery
- Automated database backups
- Point-in-time recovery
- S3 versioning for file recovery
- Disaster recovery plan

## Future Enhancements

### AI-Powered Grading
- Enhanced NLP for short answer grading
- Machine learning for essay evaluation
- Image recognition for diagram questions
- Code analysis for programming questions

### Analytics and Insights
- Learning analytics dashboard
- Student performance trends
- Question difficulty analysis
- Course effectiveness metrics

### Integration Capabilities
- LMS integration (Canvas, Blackboard, etc.)
- SSO with institutional identity providers
- API for third-party extensions
- Mobile app enhancements