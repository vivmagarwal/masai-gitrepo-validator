import express from "express";
import axios from "axios";
import * as rax from "retry-axios";
import cors from "cors";
import path from "path";
import linkify from "linkifyjs";

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const raxConfig = {
  retry: 3,

  httpMethodsToRetry: ["GET", "HEAD", "OPTIONS", "DELETE", "PUT"],

  retryCondition: (error) => {
    return (
      error.response &&
      (error.response.status < 200 || error.response.status > 299)
    );
  },

  backoffType: "exponential",

  onRetryAttempt: (err) => {
    const cfg = rax.getConfig(err);
    console.log(
      `Retry attempt #${cfg.currentRetryAttempt}: Retrying request to ${err.config.url}`
    );
  },
};

rax.attach();

async function checkLink(url) {
  let responseTime,
    working,
    tries = 0;

  try {
    const startTime = new Date();
    const response = await axios.get(url, { raxConfig });

    responseTime = new Date() - startTime; // Calculate response time
    working = response.status >= 200 && response.status < 300;
    tries = response.config.raxConfig.currentRetryAttempt + 1 || 1; // +1 for the initial attempt
  } catch (error) {
    console.error("Error checking the link:", error.message);
    responseTime = "N/A";
    working = false;
    tries = error.config.raxConfig.currentRetryAttempt || 1;
  }

  return {
    working,
    responseTime:
      typeof responseTime === "number" ? `${responseTime}ms` : responseTime,
    tries,
  };
}

async function checkReadmeExists(repoPath) {
  const readmeVariants = ["README.md", "readme.md", "Readme.md"];
  for (const variant of readmeVariants) {
    try {
      const readmeResponse = await axios.get(
        `https://api.github.com/repos/${repoPath}/contents/${variant}`
      );

      const readmeContent = Buffer.from(
        readmeResponse.data.content,
        "base64"
      ).toString("utf-8");

      console.log(readmeContent);

      if (readmeContent) {
        return {
          readmeExists: true,
          readmeContent: readmeContent,
        };
      }
    } catch (error) {
      // Continue checking the next variant
    }
  }
  return {
    readmeExists: false,
    readmeContent: null,
  }; // README not found in any variant
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
        element.key
          .toLowerCase()
          .trim()
          .includes(substring.toLowerCase().trim())
      );
      if (item) {
        const links = linkify.find(item.value);
        return links.length > 0 ? links[0].href : null;
      }
      return null;
    },

    getLinkWithInfo: async function (substring) {
      const item = this.array.find((element) =>
        element.key
          .toLowerCase()
          .trim()
          .includes(substring.toLowerCase().trim())
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

function checkProjectType(readmeContent) {
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

async function checkDeploymentDetails(readmeContent) {
  let keyValues = GetKeyValuesObject(readmeContent);

  let result = {};

  // let a = keyValues.get("frontend");
  // let b = keyValues.get("backend");
  // let c = keyValues.getLink("database");
  // let d = keyValues.getLink("key1");
  // let e = keyValues.getLink("key2");
  let frontend = await keyValues.getLinkWithInfo("frontend");
  let backend = await keyValues.getLinkWithInfo("backend");

  if (backend) result.backend = backend;
  if (frontend) result.frontend = frontend;

  return result;
}

function getHeaders(markdownContent) {
  const lines = markdownContent.split("\n");
  const headersWithContent = [];

  let currentHeader = null;

  lines.forEach((line, index) => {
    // Check if the line is a header
    const headerMatch = line.match(/^(#{1,5})\s*(.*)/);
    if (headerMatch) {
      if (currentHeader) {
        // Save the previous header with its content
        headersWithContent.push(currentHeader);
      }
      currentHeader = {
        text: headerMatch[2].trim(),
        level: headerMatch[1].length,
        content: "",
      };
    } else if (currentHeader) {
      // Accumulate content for the current header
      currentHeader.content += line + (index < lines.length - 1 ? "\n" : "");
    }
  });

  // Add the last header if exists
  if (currentHeader) {
    headersWithContent.push(currentHeader);
  }

  return {
    headersWithContent: headersWithContent,

    exists: function (substring) {
      const normalizedSubstring = substring.trim().toLowerCase();
      const header = this.headersWithContent.find((h) =>
        h.text.trim().toLowerCase().includes(normalizedSubstring)
      );
      return header
        ? {
            exists: true,
            text: header.text,
            level: header.level,
            content: header.content.trim(),
          }
        : {
            exists: false,
            text: null,
            level: null,
            content: null,
          };
    },

    contains: function (keySubstring, valueSubstring) {
      const normalizedKeySubstring = keySubstring.toLowerCase();
      const normalizedValueSubstring = valueSubstring.toLowerCase();

      return this.headersWithContent
        .filter(
          (header) =>
            header.text.toLowerCase().includes(normalizedKeySubstring) &&
            header.content.toLowerCase().includes(normalizedValueSubstring)
        )
        .map((header) => ({
          text: header.text,
          level: header.level,
          content: header.content.trim(),
        }));
    },
  };
}

function getHeaderDetails(readmeContent) {
  let headers = getHeaders(readmeContent);
  let result = {};

  result.project_type_exists = headers.exists("Project Type").exists;
  result.deployed_app_exists = headers.exists("Deployed App").exists;
  result.video_walkthrough_exists = headers.exists("Video Walkthrough").exists;
  result.technology_stack_exists = headers.exists("Technology Stack").exists;
  result.getting_started_exists = headers.exists("Getting started").exists;
  result.features_exists = headers.exists("Features").exists;

  result.is_frontend = headers.contains("Project Type", "frontend");
  result.is_backend = headers.contains("Project Type", "backend");
  result.is_fullstack = headers.contains("Project Type", "fullstack");

  // result.all_headers = headers;

  return result;
}

app.post("/get-repo-details", async (req, res) => {
  const repoUrl = req.body.url;

  if (!repoUrl) {
    return res.status(400).send({ error: "URL is required" });
  }

  try {
    const repoPath = new URL(repoUrl).pathname.substring(1);

    const { data } = await axios.get(
      `https://api.github.com/repos/${repoPath}`
    );
    const { readmeExists, readmeContent } = await checkReadmeExists(repoPath);

    const projectType = readmeExists && checkProjectType(readmeContent);
    const deploymentDetails =
      readmeExists && (await checkDeploymentDetails(readmeContent));

    const headerDetails = readmeExists && getHeaderDetails(readmeContent);

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
      heading_details: headerDetails,
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
