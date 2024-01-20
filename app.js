const express = require("express");
const axios = require("axios");
const axiosRetry = require("axios-retry").default;
const cors = require("cors");
const path = require("path");
const linkify = require("linkifyjs");
const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Configure axios to use axios-retry
// Custom retry delay
// axiosRetry(axios, { retryDelay: (retryCount) => {
//   return retryCount * 1000;
// }});


// Import and configure axios-retry
// require('axios-retry')(axios, {
//   retries: 3, // Define the number of retries
//   retryDelay: (retryCount) => {
//     return retryCount * 1000; // Delay in milliseconds
//   }
// });

// Configure axios-retry directly
// axiosRetry(axios, {
//   retries: 3, // Number of retry attempts
//   retryDelay: (retryCount) => {
//     return retryCount * 1000; // Time interval between retries (1000 ms)
//   }
// });

axiosRetry(axios, { retries: 3 });

// Adding an interceptor to track the number of retries
axios.interceptors.request.use(config => {
  config.metadata = config.metadata || {};
  config.metadata.startTime = new Date();
  return config;
}, error => {
  return Promise.reject(error);
});

async function checkLink(url) {
  let tries = 0;

  try {
    const response = await axios.get(url, {
      // Adding a response interceptor
      "axios-retry": {
        onRetryAttempt: (err) => {
          tries = err.config["axios-retry"].retryCount + 1;
        },
      },
    });

    const endTime = new Date();
    const responseTime = endTime - response.config.metadata.startTime; // Calculate response time

    return {
      working: response.status >= 200 && response.status < 300,
      responseTime: `${responseTime}ms`,
      tries: tries + 1, // Adding 1 for the initial try
    };
  } catch (error) {
    console.error("Error checking the link:", error.message);
    return {
      working: false,
      responseTime: "N/A",
      tries,
    };
  }
}

let globalResponse;
let readmeContent = "";

// Check if README exists
async function checkReadmeExists(repoPath) {
  const readmeVariants = ["README.md", "readme.md", "Readme.md"];
  for (const variant of readmeVariants) {
    try {
      const readmeResponse = await axios.get(
        `https://api.github.com/repos/${repoPath}/contents/${variant}`
      );
      readmeContent = Buffer.from(
        readmeResponse.data.content,
        "base64"
      ).toString("utf-8");
      return true; // Found the README
    } catch (error) {
      // Continue checking the next variant
    }
  }
  return false; // README not found in any variant
}

function GetKeyValuesObject(readmeContent) {
  const lines = readmeContent.split("\n");
  const parsedData = [];

  lines.forEach((line) => {
    let separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) {
      separatorIndex = line.indexOf("=");
    }

    if (separatorIndex !== -1) {
      const key = line.substring(0, separatorIndex).trim();
      const value = line.substring(separatorIndex + 1).trim();
      parsedData.push({ key, value });
    }
  });

  console.log(parsedData);


  const values = {
    array: parsedData,

    get: function (substring) {
      const item = this.array.find((element) =>
        element.key.toLowerCase().includes(substring.toLowerCase())
      );
      return item ? item.value : null;
    },

    getLink: function (substring) {
      const item = this.array.find((element) =>
        element.key.includes(substring)
      );
      if (item) {
        const links = linkify.find(item.value);
        return links.length > 0 ? links[0].href : null;
      }
      return null;
    },

    getLinkAsync: async function (substring) {
      const item = this.array.find((element) =>
        element.key.includes(substring)
      );
      if (item) {
        const links = linkify.find(item.value);
        if (links.length > 0) {
          const url = links[0].href;
          const checkResult = await checkLink(url);
          return {
            url: url,
            working: checkResult.working,
            responseTime: checkResult.responseTime,
            tries: checkResult.tries,
          };
        }
      }
      return null;
    },
  };

  return values;
}


// Check project type
function checkProjectType() {
  try {
    const projectTypeMatch = readmeContent.match(
      /## Project Type\s*\n*- (Frontend|Backend|Fullstack)/i
    );
    if (projectTypeMatch) {
      return projectTypeMatch[1]; // Frontend, Backend, or Fullstack
    }
    return "Unknown";
  } catch (error) {
    return "Error checking project type";
  }
}

async function checkDeploymentDetails() {
  let keyValues = GetKeyValuesObject(readmeContent);

  let result = {};

  let frontend = keyValues.get("frontend");
  let backend = keyValues.getLink("backend");
  let database = keyValues.get("database") || keyValues.get("db");
  let key1 = keyValues.getLink("key1")
  let key2 = keyValues.getLink("key2")
  let key1Async = await keyValues.getLinkAsync("key1");
  let backendAsync = await keyValues.getLinkAsync("backend");

  if (frontend) {
    result.frontend = frontend;
  }
  if (backend) {
    result.backend = backend;
  }
  if (database) {
    result.database = database;
  }

  result.key1 = key1;
  result.key2 = key2;
  result.key1Async = key1Async;
  result.backendAsync = backendAsync;

  return result;
}

// API Endpoint
app.post("/get-repo-details", async (req, res) => {
  const repoUrl = req.body.url;

  if (!repoUrl) {
    return res.status(400).send({ error: "URL is required" });
  }

  try {
    const repoPath = new URL(repoUrl).pathname.substring(1);
    
    globalResponse = await axios.get(
      `https://api.github.com/repos/${repoPath}`
    );
    
    const { data } = globalResponse;

    const readmeExists = await checkReadmeExists(repoPath);
    const projectType = readmeExists && checkProjectType();
    const deploymentDetails = readmeExists && await checkDeploymentDetails() 

    const repoDetails = {
      name: data.name,
      owner: data.owner.login,
      stars: data.stargazers_count,
      forks: data.forks_count,
      open_issues: data.open_issues_count,
      language: data.language,
      readme_exists: readmeExists,
      project_type: projectType,
      deployment_details: deploymentDetails,
    };

    res.send(repoDetails);
  } catch (error) {
    res.status(500).send({ error: error.message });
  }
});

app.get("/try", (req, res) => {
  res.sendFile(path.join(__dirname, "/public/index.html"));
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
