# GitHub Repo Analyzer

## Introduction
The GitHub Repo Analyzer is an application designed to provide insights into GitHub repositories. It evaluates the README.md file, extracting valuable information about the project, its deployment details, and structural components. This tool helps developers, project managers, and contributors to quickly understand and analyze key aspects of a repository.

## Project Type
- Fullstack

## Deployed App
- Frontend: [Frontend Deployment](https://tiny-plum-crow-cuff.cyclic.app/)
- Backend: [Backend Deployment](https://nice-outfit-tuna.cyclic.app/users/register)
- Database: [Database Access](https://deployed-site.whatever)

## Directory Structure
```
github-repo-analyzer/
├─ server/
│  ├─ controllers/
│  ├─ routes/
│  ├─ utils/
├─ public/
│  ├─ index.html
```

## Video Walkthrough of the Project
A short video walkthrough (1-3 minutes) showcasing the application's features and user interface.

## Video Walkthrough of the Codebase
A brief video tour (1-5 minutes) of the codebase, explaining the structure and main components.

## Features
- Real-time analysis of GitHub repositories.
- Extraction of key details from README.md.
- Deployment details and project type classification.
- Visualization of project structure and technology stack.

## Design Decisions or Assumptions
- Assumed standard README.md formats for analysis.
- Focus on extracting deployment details, project types, and key features.
- Scalability and ease of maintenance in the server architecture.

## Installation & Getting Started
```bash
git clone https://github.com/your-repository.git
cd github-repo-analyzer
npm install
npm start
```
This starts the server, making the application accessible locally.

## Usage
The app provides a web interface where users can input a GitHub repository URL to analyze. The analysis results are displayed in an easy-to-read format.

## Credentials
- Username: user@example.com
- Password: password123

## APIs Used
- GitHub API: For fetching repository details and README.md content.

## API Endpoints
- `GET /get-repo-details`: Retrieves detailed analysis of the input repository.
- `POST /api/analyze`: Submits a repository URL for analysis.

## Technology Stack
- Node.js: Server-side JavaScript runtime.
- Express.js: Web application framework for Node.js.
- Axios: Promise-based HTTP client for Node.js.
- Other libraries: `retry-axios` for retrying failed requests, `cors` for cross-origin resource sharing, `path` for file path utilities, `linkifyjs` for extracting links from text.