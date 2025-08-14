#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import { config } from 'dotenv';

import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables from the server.js directory
config({ path: path.join(__dirname, '.env') });

// JIRA Configuration
const JIRA_CONFIG = {
  baseURL: process.env.JIRA_BASE_URL,
  auth: {
    username: process.env.JIRA_EMAIL,
    password: process.env.JIRA_API_TOKEN
  },
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  }
};

// Create JIRA client
const jiraClient = axios.create(JIRA_CONFIG);

class JiraMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'jira-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  setupToolHandlers() {
    // Register available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'create_jira_ticket',
            description: 'Create a new JIRA ticket',
            inputSchema: {
              type: 'object',
              properties: {
                summary: {
                  type: 'string',
                  description: 'Ticket title/summary',
                },
                description: {
                  type: 'string',
                  description: 'Ticket description',
                },
                issueType: {
                  type: 'string',
                  description: 'Issue type (Task, Bug, Story, Epic)',
                  default: 'Task',
                },
                projectKey: {
                  type: 'string',
                  description: 'JIRA project key',
                },
                priority: {
                  type: 'string',
                  description: 'Priority (Highest, High, Medium, Low, Lowest)',
                  default: 'Medium',
                },
              },
              required: ['summary', 'description'],
            },
          },
          {
            name: 'get_jira_tickets',
            description: 'Search and retrieve JIRA tickets with filters',
            inputSchema: {
              type: 'object',
              properties: {
                jql: {
                  type: 'string',
                  description: 'JQL (JIRA Query Language) string for advanced search',
                },
                assignee: {
                  type: 'string',
                  description: 'Filter by assignee username or email',
                },
                status: {
                  type: 'string',
                  description: 'Filter by status (To Do, In Progress, Done, etc.)',
                },
                projectKey: {
                  type: 'string',
                  description: 'Filter by project key',
                },
                maxResults: {
                  type: 'number',
                  description: 'Maximum number of results to return',
                  default: 20,
                },
              },
            },
          },
          {
            name: 'get_jira_ticket_details',
            description: 'Get detailed information about a specific JIRA ticket',
            inputSchema: {
              type: 'object',
              properties: {
                ticketKey: {
                  type: 'string',
                  description: 'JIRA ticket key (e.g., PROJ-123)',
                },
                includeComments: {
                  type: 'boolean',
                  description: 'Include ticket comments in response',
                  default: true,
                },
                includeHistory: {
                  type: 'boolean',
                  description: 'Include ticket change history',
                  default: false,
                },
              },
              required: ['ticketKey'],
            },
          },
          {
            name: 'update_jira_ticket',
            description: 'Update a JIRA ticket (status, assignee, fields)',
            inputSchema: {
              type: 'object',
              properties: {
                ticketKey: {
                  type: 'string',
                  description: 'JIRA ticket key to update',
                },
                summary: {
                  type: 'string',
                  description: 'Update ticket summary',
                },
                description: {
                  type: 'string',
                  description: 'Update ticket description',
                },
                assignee: {
                  type: 'string',
                  description: 'Assign to user (email or username)',
                },
                status: {
                  type: 'string',
                  description: 'Transition to new status',
                },
                priority: {
                  type: 'string',
                  description: 'Update priority',
                },
              },
              required: ['ticketKey'],
            },
          },
          {
            name: 'add_jira_comment',
            description: 'Add a comment to a JIRA ticket',
            inputSchema: {
              type: 'object',
              properties: {
                ticketKey: {
                  type: 'string',
                  description: 'JIRA ticket key',
                },
                comment: {
                  type: 'string',
                  description: 'Comment text to add',
                },
                visibility: {
                  type: 'string',
                  description: 'Comment visibility (public, internal)',
                  default: 'public',
                },
              },
              required: ['ticketKey', 'comment'],
            },
          },
          {
            name: 'get_jira_projects',
            description: 'List available JIRA projects',
            inputSchema: {
              type: 'object',
              properties: {
                expand: {
                  type: 'string',
                  description: 'Additional project details to include',
                  default: 'description,lead',
                },
              },
            },
          },
        ],
      };
    });

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'create_jira_ticket':
            return await this.createJiraTicket(args);
          case 'get_jira_tickets':
            return await this.getJiraTickets(args);
          case 'get_jira_ticket_details':
            return await this.getJiraTicketDetails(args);
          case 'update_jira_ticket':
            return await this.updateJiraTicket(args);
          case 'add_jira_comment':
            return await this.addJiraComment(args);
          case 'get_jira_projects':
            return await this.getJiraProjects(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error executing ${name}: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  async createJiraTicket(args) {
    const { summary, description, issueType = 'Task', projectKey, priority = 'Medium' } = args;
    
    const issueData = {
      fields: {
        project: { key: projectKey || process.env.JIRA_PROJECT_KEY },
        summary: summary,
        description: {
          type: "doc",
          version: 1,
          content: [{
            type: "paragraph",
            content: [{ type: "text", text: description }]
          }]
        },
        issuetype: { name: issueType },
        priority: { name: priority }
      }
    };

    const response = await jiraClient.post('/rest/api/3/issue', issueData);
    
    return {
      content: [
        {
          type: 'text',
          text: `✅ Successfully created JIRA ticket!

🎫 **Ticket Details:**
- **Key:** ${response.data.key}
- **ID:** ${response.data.id}
- **URL:** ${process.env.JIRA_BASE_URL}/browse/${response.data.key}
- **Summary:** ${summary}
- **Type:** ${issueType}
- **Priority:** ${priority}

The ticket has been created and is ready for work. You can access it directly using the URL above.`,
        },
      ],
    };
  }

  async getJiraTickets(args) {
    const { jql, assignee, status, projectKey, maxResults = 20 } = args;
    
    let searchJql = jql;
    if (!searchJql) {
      // Build JQL from filters
      const conditions = [];
      if (projectKey) conditions.push(`project = "${projectKey}"`);
      if (assignee) conditions.push(`assignee = "${assignee}"`);
      if (status) conditions.push(`status = "${status}"`);
      
      searchJql = conditions.length > 0 ? conditions.join(' AND ') : `project = "${process.env.JIRA_PROJECT_KEY}"`;
    }
    
    const response = await jiraClient.get('/rest/api/3/search', {
      params: {
        jql: searchJql,
        maxResults: maxResults,
        fields: 'key,summary,status,assignee,created,updated,priority,issuetype'
      }
    });

    const tickets = response.data.issues.map(issue => ({
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status.name,
      assignee: issue.fields.assignee?.displayName || 'Unassigned',
      priority: issue.fields.priority?.name || 'None',
      type: issue.fields.issuetype.name,
      created: new Date(issue.fields.created).toLocaleDateString(),
      updated: new Date(issue.fields.updated).toLocaleDateString(),
      url: `${process.env.JIRA_BASE_URL}/browse/${issue.key}`
    }));

    const ticketList = tickets.map(ticket => 
      `🎫 **${ticket.key}** - ${ticket.summary}
   📊 Status: ${ticket.status} | 👤 Assignee: ${ticket.assignee}
   🔗 ${ticket.url}`
    ).join('\n\n');

    return {
      content: [
        {
          type: 'text',
          text: `📋 **Found ${response.data.total} JIRA tickets** (showing ${tickets.length}):

${ticketList}

**Search Query:** ${searchJql}`,
        },
      ],
    };
  }

  async getJiraTicketDetails(args) {
    const { ticketKey, includeComments = true, includeHistory = false } = args;
    
    let fields = 'key,summary,description,status,assignee,creator,created,updated,priority,issuetype,project';
    if (includeComments) fields += ',comment';
    if (includeHistory) fields += ',changelog';
    
    const response = await jiraClient.get(`/rest/api/3/issue/${ticketKey}`, {
      params: { fields, expand: includeHistory ? 'changelog' : '' }
    });

    const issue = response.data;
    let ticketDetails = `🎫 **${issue.key}**: ${issue.fields.summary}

📝 **Description:** ${issue.fields.description?.content?.[0]?.content?.[0]?.text || 'No description'}

📊 **Status:** ${issue.fields.status.name}
👤 **Assignee:** ${issue.fields.assignee?.displayName || 'Unassigned'}
👨‍💻 **Creator:** ${issue.fields.creator.displayName}
⚡ **Priority:** ${issue.fields.priority?.name || 'None'}
🏷️ **Type:** ${issue.fields.issuetype.name}
📅 **Created:** ${new Date(issue.fields.created).toLocaleString()}
🔄 **Updated:** ${new Date(issue.fields.updated).toLocaleString()}
🔗 **URL:** ${process.env.JIRA_BASE_URL}/browse/${issue.key}`;

    if (includeComments && issue.fields.comment?.comments?.length > 0) {
      const recentComments = issue.fields.comment.comments.slice(-3);
      ticketDetails += '\n\n💬 **Recent Comments:**\n';
      recentComments.forEach(comment => {
        ticketDetails += `\n👤 **${comment.author.displayName}** (${new Date(comment.created).toLocaleDateString()}):\n${comment.body.content?.[0]?.content?.[0]?.text || 'No text content'}\n`;
      });
    }

    return {
      content: [
        {
          type: 'text',
          text: ticketDetails,
        },
      ],
    };
  }

  async updateJiraTicket(args) {
    const { ticketKey, summary, description, assignee, status, priority } = args;
    
    const updates = [];
    const updateData = { fields: {} };
    
    // Handle field updates
    if (summary) {
      updateData.fields.summary = summary;
      updates.push(`Summary updated to: "${summary}"`);
    }
    
    if (description) {
      updateData.fields.description = {
        type: "doc",
        version: 1,
        content: [{
          type: "paragraph",
          content: [{ type: "text", text: description }]
        }]
      };
      updates.push('Description updated');
    }
    
    if (priority) {
      updateData.fields.priority = { name: priority };
      updates.push(`Priority set to: ${priority}`);
    }
    
    if (assignee) {
      // Try to find user by email or username
      try {
        const userResponse = await jiraClient.get(`/rest/api/3/user/search`, {
          params: { query: assignee }
        });
        if (userResponse.data.length > 0) {
          updateData.fields.assignee = { accountId: userResponse.data[0].accountId };
          updates.push(`Assigned to: ${userResponse.data[0].displayName}`);
        }
      } catch (error) {
        updates.push(`⚠️ Could not find user: ${assignee}`);
      }
    }
    
    // Apply field updates
    if (Object.keys(updateData.fields).length > 0) {
      await jiraClient.put(`/rest/api/3/issue/${ticketKey}`, updateData);
    }
    
    // Handle status transition separately
    if (status) {
      try {
        const transitionsResponse = await jiraClient.get(`/rest/api/3/issue/${ticketKey}/transitions`);
        const transition = transitionsResponse.data.transitions.find(t => 
          t.to.name.toLowerCase() === status.toLowerCase()
        );
        
        if (transition) {
          await jiraClient.post(`/rest/api/3/issue/${ticketKey}/transitions`, {
            transition: { id: transition.id }
          });
          updates.push(`Status changed to: ${status}`);
        } else {
          updates.push(`⚠️ Could not transition to status: ${status}`);
        }
      } catch (error) {
        updates.push(`⚠️ Status update failed: ${error.message}`);
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: `✅ **Updated ticket ${ticketKey}**

🔄 **Changes made:**
${updates.map(update => `• ${update}`).join('\n')}

🔗 **View ticket:** ${process.env.JIRA_BASE_URL}/browse/${ticketKey}`,
        },
      ],
    };
  }

  async addJiraComment(args) {
    const { ticketKey, comment, visibility = 'public' } = args;
    
    const commentData = {
      body: {
        type: "doc",
        version: 1,
        content: [{
          type: "paragraph",
          content: [{ type: "text", text: comment }]
        }]
      }
    };

    await jiraClient.post(`/rest/api/3/issue/${ticketKey}/comment`, commentData);

    return {
      content: [
        {
          type: 'text',
          text: `✅ **Comment added to ${ticketKey}**

💬 **Comment:** ${comment}

🔗 **View ticket:** ${process.env.JIRA_BASE_URL}/browse/${ticketKey}`,
        },
      ],
    };
  }

  async getJiraProjects(args) {
    const { expand = 'description,lead' } = args;
    
    const response = await jiraClient.get('/rest/api/3/project', {
      params: { expand }
    });

    const projects = response.data.map(project => ({
      key: project.key,
      name: project.name,
      description: project.description || 'No description',
      lead: project.lead?.displayName || 'No lead assigned',
      projectType: project.projectTypeKey,
      url: `${process.env.JIRA_BASE_URL}/projects/${project.key}`
    }));

    const projectList = projects.map(project => 
      `📁 **${project.key}** - ${project.name}
   📝 ${project.description}
   👤 Lead: ${project.lead}
   🔗 ${project.url}`
    ).join('\n\n');

    return {
      content: [
        {
          type: 'text',
          text: `📂 **Available JIRA Projects** (${projects.length} total):

${projectList}`,
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('🚀 JIRA MCP Server running on stdio');
  }
}

// Create and run the server
const server = new JiraMCPServer();
server.run().catch(console.error);