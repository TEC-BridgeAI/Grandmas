# GRANDMAS - Grading And Management System

**Open Source**  
This project is open-source and licensed under the [Apache License 2.0](LICENSE). The source code is available at: [https://github.com/TEC-BridgeAI/grandmas](https://github.com/TEC-BridgeAI/grandmas)

A comprehensive grading and management system that can handle various question types and input methods.

## Features

- User authentication and role-based access control
- Support for multiple question types:
  - True/False
  - Multiple choice
  - Matching
  - Short answer
  - Essay
  - Fill-in-the-blank
  - Computational questions
  - Diagram-based questions
  - Drag-and-drop
  - Programming/coding
  - Oral questions
- Web and mobile interfaces
- Serverless architecture for grading
- Aurora PostgreSQL database for data storage

## Architecture

- **Frontend**: React.js web application and React Native mobile app
- **Backend**: AWS Lambda serverless functions
- **Database**: Amazon Aurora PostgreSQL
- **Authentication**: Amazon Cognito
- **File Storage**: Amazon S3
- **API Gateway**: RESTful API endpoints

## Project Structure

```
grandmas/
├── frontend/                # Web and mobile interfaces
│   ├── web/                 # React.js web application
│   └── mobile/              # React Native mobile app
├── backend/                 # Serverless functions
│   ├── auth/                # Authentication functions
│   ├── courses/             # Course management functions
│   ├── assignments/         # Assignment functions
│   ├── grading/             # Grading engine functions
│   └── admin/               # Administrative functions
├── database/                # Database schemas and migrations
└── docs/                    # Documentation
```