# JIRA MCP Server

A Model Context Protocol (MCP) server that enables **bi-directional communication** between AI assistants (like GitHub Copilot) and JIRA, allowing you to create, query, and manage JIRA tickets through natural language interactions.

## 🎯 What This Project Does

This MCP server acts as a **bridge** between AI assistants and JIRA, enabling:

- ✅ **Create JIRA tickets** through AI chat
- ✅ **Query and search tickets** with natural language
- ✅ **Update ticket status** and properties
- ✅ **Add comments** to existing tickets
- ✅ **Get detailed ticket information**
- ✅ **List projects** and browse JIRA data

**Example interactions:**
- *"Create a JIRA ticket for fixing the login bug"*
- *"Show me all high-priority tickets assigned to John"*
- *"Update ticket DEV-123 status to In Progress"*

## 🔄 How Bi-directional Communication Works

### The Architecture Flow

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   GitHub        │    │   MCP Server    │    │   JIRA API      │
│   Copilot       │◄──►│   (Your Code)   │◄──►│   (Atlassian)   │
│   (AI Agent)    │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Outbound: AI → JIRA (Commands & Actions)

**User Input**: *"Create a JIRA ticket for fixing the login bug"*

1. **GitHub Copilot** receives natural language request
2. **Copilot's AI** determines this needs JIRA interaction
3. **MCP Protocol** calls your server's `create_jira_ticket` tool
4. **Your MCP Server** receives structured parameters:
   ```json
   {
     "summary": "Fix login bug",
     "description": "User reported login authentication issues",
     "issueType": "Bug",
     "priority": "High"
   }
   ```
5. **Your Server** makes HTTP call to JIRA REST API
6. **JIRA** creates the ticket and returns ticket ID
7. **Your Server** formats response for AI
8. **Copilot** presents success message to user

### Inbound: JIRA → AI (Data & Information)

**User Input**: *"Show me all tickets assigned to John"*

1. **GitHub Copilot** recognizes this as a query request
2. **MCP Protocol** calls your server's `get_jira_tickets` tool
3. **Your MCP Server** receives query parameters:
   ```json
   {
     "assignee": "john@company.com",
     "maxResults": 20
   }
   ```
4. **Your Server** queries JIRA REST API with JQL
5. **JIRA** returns ticket data (JSON)
6. **Your Server** processes and formats the data:
   ```json
   {
     "tickets": [
       {
         "key": "DEV-123",
         "summary": "Fix authentication bug",
         "status": "In Progress",
         "assignee": "John Smith"
       }
     ]
   }
   ```
7. **MCP Protocol** sends formatted data back to Copilot
8. **Copilot** presents human-readable results to user

### The "Bi-directional" Magic

**Why it's truly bi-directional:**

🔄 **Real-time Data Flow**: AI can both **send commands** to JIRA and **receive live data** from JIRA

🔄 **Context Awareness**: When you ask follow-up questions, the AI can query current JIRA state

🔄 **Dynamic Responses**: JIRA data changes are immediately available to the AI

### Technical Implementation

#### MCP Protocol Handling (Your `server.js`)

```javascript
// Tool Discovery - AI learns what JIRA operations are available
this.server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      { name: 'create_jira_ticket', description: 'Create new tickets' },
      { name: 'get_jira_tickets', description: 'Query existing tickets' },
      // ... more tools
    ]
  };
});

// Tool Execution - AI calls your JIRA functions
this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  switch (name) {
    case 'create_jira_ticket':
      return await this.createJiraTicket(args);  // AI → JIRA
    case 'get_jira_tickets':
      return await this.getJiraTickets(args);    // JIRA → AI
  }
});
```

#### JIRA API Integration

```javascript
// Outbound: AI request → JIRA action
async createJiraTicket(args) {
  const response = await jiraClient.post('/rest/api/3/issue', {
    fields: {
      summary: args.summary,
      description: args.description
    }
  });
  return { ticketKey: response.data.key };  // Back to AI
}

// Inbound: JIRA data → AI information
async getJiraTickets(args) {
  const response = await jiraClient.get('/rest/api/3/search', {
    params: { jql: `assignee = "${args.assignee}"` }
  });
  return { tickets: response.data.issues };  // Back to AI
}
```

### Communication Protocol Details

#### Message Flow Example

**User**: *"Create a bug ticket and then show me all my tickets"*

## 📁 Project Structure

```
mcp-jira-server/
├── server.js              # Main MCP server implementation
├── package.json           # Node.js dependencies and scripts
├── .env                   # JIRA credentials (create this file)
├── .env.example           # Template for environment variables
├── .gitignore            # Protects sensitive files from git
├── test-mcp.js           # Test script for MCP server
├── .vscode/              # VS Code configuration
│   └── mcp.json          # MCP server configuration for VS Code
└── README.md            # This file
```

## 🔧 File Explanations

### `server.js` - Core MCP Server
The main server file that implements the **Model Context Protocol**:
- **MCP Protocol Handler**: Manages communication with AI assistants
- **JIRA API Integration**: Connects to JIRA using REST APIs
- **Tool Definitions**: Defines available tools (create ticket, query tickets, etc.)
- **Stdio Transport**: Uses stdin/stdout for communication with VS Code

**Key components:**
- `JiraMCPServer` class - Main server logic
- `setupToolHandlers()` - Registers available tools with AI assistants
- Individual tool methods (`createJiraTicket`, `getJiraTickets`, etc.)

### `package.json` - Dependencies & Scripts
Defines project metadata and dependencies:
- **MCP SDK**: `@modelcontextprotocol/sdk` for MCP protocol implementation
- **HTTP Client**: `axios` for JIRA API calls
- **Environment Variables**: `dotenv` for secure credential management
- **Scripts**: `npm start` to run the server, `npm test` to run tests

### `.env` - Secure Configuration
Contains sensitive JIRA credentials (⚠️ **never commit this file**):
```bash
JIRA_BASE_URL=https://yourcompany.atlassian.net
JIRA_EMAIL=your-email@example.com
JIRA_API_TOKEN=your-api-token
JIRA_PROJECT_KEY=YOUR_PROJECT_KEY
```

### `.env.example` - Configuration Template
A safe template showing required environment variables without exposing actual credentials.

### `.vscode/mcp.json` - VS Code Integration
Configures the MCP server for use with VS Code and GitHub Copilot:
- Tells VS Code how to start the server
- Enables Agent mode integration
- Allows natural language interaction with JIRA

## 🚀 Setup Instructions

### Prerequisites
- **Node.js 18+** - [Download here](https://nodejs.org/)
- **VS Code** with **GitHub Copilot** extension
- **JIRA account** with API access

### Step 1: Clone and Install

```bash
# Clone the repository (or download the files)
git clone <your-repo-url>
cd mcp-jira-server

# Install dependencies
npm install
```

### Step 2: Configure JIRA Credentials

1. **Copy the environment template:**
   ```bash
   cp .env.example .env
   ```

2. **Get your JIRA API token:**
   - Go to: https://id.atlassian.com/manage-profile/security/api-tokens
   - Click "Create API token"
   - Copy the generated token

3. **Edit `.env` file** with your actual JIRA details:
   ```bash
   JIRA_BASE_URL=https://yourcompany.atlassian.net
   JIRA_EMAIL=your-email@example.com
   JIRA_API_TOKEN=your-api-token-here
   JIRA_PROJECT_KEY=YOUR_PROJECT_KEY
   ```

4. **Find your project key:**
   - Look at any JIRA ticket URL: `https://company.atlassian.net/browse/PROJ-123` → Key is `PROJ`
   - Or check your project settings in JIRA

### Step 3: Test the Server

```bash
# Test JIRA connection
npm test

# You should see:
# ✅ Connected to MCP server
# ✅ Tool discovery successful
# ✅ JIRA integration working
```

### Step 4: Configure VS Code

#### Method A: Using VS Code Commands (Recommended)

1. **Open VS Code**
2. **Press** `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (macOS)
3. **Type:** `MCP: Add Server`
4. **Fill in details:**
   - **Name:** `jira`
   - **Command:** `node`
   - **Arguments:** `server.js`
   - **Working Directory:** `/absolute/path/to/your/mcp-jira-server`
5. **Choose:** "Global" (available in all projects)
6. **Restart VS Code**

#### Method B: Manual Configuration

Create `.vscode/mcp.json` in your project root:

```json
{
  "servers": {
    "jira": {
      "type": "stdio",
      "command": "node",
      "args": ["server.js"]
    }
  }
}
```

### Step 5: Enable Agent Mode

1. **Open VS Code Settings** (`Ctrl+,`)
2. **Search for:** `chat.agent.enabled`
3. **Check the box** ✅
4. **Restart VS Code**

### Step 6: Test Integration

1. **Open GitHub Copilot Chat** (click chat icon in sidebar)
2. **Select "Agent" mode** from dropdown
3. **Test commands:**
   ```
   What JIRA tools do you have available?
   ```
   ```
   Create a JIRA ticket for fixing the login bug
   ```
   ```
   Show me all tickets assigned to me
   ```

## 🎯 Usage Examples

Once set up, you can interact with JIRA through natural language in VS Code:

### Creating Tickets
```
"Create a JIRA ticket called 'Fix login authentication bug' with high priority"
```

### Querying Tickets
```
"Show me all open tickets assigned to John Smith"
"List all high-priority bugs in the current sprint"
"What tickets are in 'In Progress' status?"
```

### Updating Tickets
```
"Update ticket DEV-123 status to 'Done'"
"Assign ticket PROJ-456 to alice@company.com"
"Add a comment to DEV-789 saying 'Fixed in latest deployment'"
```

### Getting Information
```
"Get details for ticket DEV-123"
"Show me all available JIRA projects"
"What's the current status of ticket PROJ-456?"
```

## 🔒 Security Notes

- **Never commit `.env`** - Contains sensitive API credentials
- **API token has full account access** - Keep it secure
- **Use project-specific tokens** when possible
- **Regularly rotate API tokens** for security

## 🚨 Troubleshooting

### Common Issues

**"Server failed to start"**
- Check your absolute path is correct
- Verify Node.js is installed: `node --version`
- Ensure dependencies are installed: `npm install`

**"JIRA connection failed"**
- Verify credentials in `.env` file
- Test JIRA URL in browser
- Check API token is valid

**"No tools available"**
- Ensure Agent mode is enabled in VS Code
- Check `MCP: List Servers` shows "Connected"
- Restart VS Code after configuration changes

**"Command not found"**
- Use absolute paths in MCP configuration
- Check working directory is correct
- Verify `server.js` exists in specified location

### Getting Help

1. **Check server output:** `MCP: List Servers → Show Output`
2. **Verify JIRA connection:** Run manual test commands above
3. **Check VS Code console:** Help → Toggle Developer Tools
4. **Test tools individually:** Use `#tool_name` in Agent mode


## 🚀 Next Steps

- **Add more JIRA operations** (bulk updates, advanced search)
- **Integrate with Confluence** for documentation
- **Add Azure DevOps support** for alternative project management


