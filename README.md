# Doctor Desk Navigation System API

A Node.js API for managing hospital examination room queues and patient flow using Express.js and Microsoft SQL Server.

## Features

- **Examination Room Management**: Create, read, update, and delete examination rooms
- **Patient Queue Management**: Add patients to queues, call next patients, update queue status
- **Queue History Tracking**: Complete audit trail of all queue actions
- **Real-time Statistics**: Department and room performance analytics
- **Priority Queue Support**: Emergency, urgent, and normal priority levels
- **Multi-department Support**: Manage multiple hospital departments

## Prerequisites

- Node.js v12.22.12 or higher
- Microsoft SQL Server 2016 or higher
- npm or yarn package manager

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd queue-api
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` file with your database configuration:
   ```env
   DB_SERVER=localhost
   DB_PORT=1433
   DB_DATABASE=QNurseDB
   DB_USER=your_username
   DB_PASSWORD=your_password
   DB_ENCRYPT=true
   DB_TRUST_SERVER_CERTIFICATE=true
   
   PORT=3000
   NODE_ENV=development
   API_VERSION=v1
   ```

4. **Set up the database**
   - Create a database named `QNurseDB` in your SQL Server instance
   - Run the setup script: `database/setup.sql`

5. **Start the server**
   ```bash
   # Development mode with auto-reload
   npm run dev
   
   # Production mode
   npm start
   ```

## API Endpoints

### Base URL
```
http://localhost:3000/api/v1
```

### Health Check
- `GET /health` - Server health status

### Examination Rooms
- `GET /rooms` - Get all examination rooms
- `GET /rooms/:id` - Get room by ID
- `POST /rooms` - Create new room
- `PUT /rooms/:id` - Update room
- `DELETE /rooms/:id` - Delete room
- `GET /rooms/:id/stats` - Get room statistics

### Patient Queues
- `GET /queues` - Get all patient queues
- `GET /queues/:id` - Get queue by ID
- `POST /queues` - Add patient to queue
- `PUT /queues/:id/status` - Update queue status
- `POST /queues/room/:roomId/call-next` - Call next patient in room
- `GET /queues/room/:roomId/stats` - Get queue statistics for room

### Queue History
- `GET /history` - Get queue history
- `GET /history/queue/:queueId` - Get history by queue ID
- `GET /history/room/:roomId` - Get history by room
- `POST /history` - Create history entry (admin)
- `GET /history/stats` - Get history statistics

### Statistics
- `GET /stats/overview` - Overall system statistics
- `GET /stats/rooms/performance` - Room performance statistics
- `GET /stats/hourly` - Hourly statistics
- `GET /stats/waiting-times` - Waiting time analysis
- `GET /stats/departments/compare` - Department comparison

## Database Schema

### Tables

1. **examination_rooms**: Room information and current queue status
2. **patient_queues**: Patient queue records with status tracking
3. **queue_history**: Complete audit trail of all queue actions
4. **department_settings**: Department-specific configuration

### Stored Procedures

1. **AddPatientToQueue**: Add a new patient to a room's queue
2. **CallNextPatient**: Call the next patient in a room's queue

### Views

1. **active_room_queues**: Current queue status for all active rooms
2. **department_stats**: Department-level statistics

## API Usage Examples

### Add Patient to Queue
```bash
curl -X POST http://localhost:3000/api/v1/queues \
  -H "Content-Type: application/json" \
  -d '{
    "hn": "HN001",
    "patient_name": "John Doe",
    "room_id": 1,
    "department": "อายุรกรรม",
    "priority_level": "normal"
  }'
```

### Call Next Patient
```bash
curl -X POST http://localhost:3000/api/v1/queues/room/1/call-next \
  -H "Content-Type: application/json" \
  -d '{
    "performed_by": "nurse001"
  }'
```

### Get Room Statistics
```bash
curl http://localhost:3000/api/v1/rooms/1/stats
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_SERVER` | SQL Server hostname | localhost |
| `DB_PORT` | SQL Server port | 1433 |
| `DB_DATABASE` | Database name | QNurseDB |
| `DB_USER` | Database username | - |
| `DB_PASSWORD` | Database password | - |
| `DB_ENCRYPT` | Enable encryption | true |
| `DB_TRUST_SERVER_CERTIFICATE` | Trust server certificate | true |
| `PORT` | API server port | 3000 |
| `NODE_ENV` | Environment | development |
| `API_VERSION` | API version | v1 |

### Security Features

- Rate limiting (1000 requests per 15 minutes per IP)
- Input validation using Joi
- SQL injection protection
- CORS enabled
- Helmet security headers

## Error Handling

The API returns consistent error responses:

```json
{
  "error": "Error type",
  "message": "Detailed error message",
  "details": [] // For validation errors
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `404` - Not Found
- `409` - Conflict (duplicate data)
- `500` - Internal Server Error
- `503` - Service Unavailable (database connection issues)

## Development

### Project Structure
```
queue-api/
├── config/
│   └── database.js          # Database configuration
├── database/
│   └── setup.sql           # Database setup script
├── middleware/
│   └── validation.js       # Input validation
├── routes/
│   ├── rooms.js           # Room management routes
│   ├── queues.js          # Queue management routes
│   ├── history.js         # History tracking routes
│   └── stats.js           # Statistics routes
├── server.js              # Main application file
├── package.json           # Dependencies and scripts
├── env.example            # Environment variables template
└── README.md             # This file
```

### Running Tests
```bash
npm test
```

### Code Style
- ESLint configuration for consistent code style
- Prettier for code formatting

## Debugging

The project is configured for debugging with VS Code and Chrome DevTools.

### Using VS Code Debugger

1. **Open the Debug Panel**
   - Press `F5` or click the Debug icon in the sidebar
   - Select a debug configuration from the dropdown

2. **Available Debug Configurations**
   - **Debug: Start Server** - Start the server with debugging enabled
   - **Debug: Current File** - Debug the currently open file
   - **Debug: Server (with nodemon)** - Debug with auto-reload on file changes
   - **Attach to Process** - Attach debugger to an already running process

3. **Setting Breakpoints**
   - Click in the gutter (left of line numbers) to set breakpoints
   - The debugger will pause execution when breakpoints are hit

4. **Debug Controls**
   - **Continue** (`F5`) - Continue execution
   - **Step Over** (`F10`) - Execute current line, step over function calls
   - **Step Into** (`F11`) - Step into function calls
   - **Step Out** (`Shift+F11`) - Step out of current function
   - **Restart** (`Ctrl+Shift+F5`) - Restart debugging session
   - **Stop** (`Shift+F5`) - Stop debugging

### Using Node.js Inspector

Run the server with debugging enabled:

```bash
npm run debug
```

Then open Chrome DevTools at `chrome://inspect` or use VS Code's attach configuration.

### Debug Scripts

- `npm run debug` - Start server with inspector (port 9229)
- `npm run debug-brk` - Start server with inspector and break on start

### Environment Variables

The debugger automatically loads environment variables from `.env` file.

### Tips for Debugging

1. **Database Connections**: Set breakpoints in `config/database.js` to debug connection issues
2. **API Routes**: Set breakpoints in route handlers to inspect request data
3. **Validation**: Check validated request bodies after Joi validation middleware
4. **Error Handling**: Use the debugger to step through error handlers and inspect error objects

## Deployment

### Production Considerations

1. **Database Security**
   - Use strong passwords
   - Enable SSL/TLS encryption
   - Restrict database access by IP

2. **Server Security**
   - Use environment variables for sensitive data
   - Enable HTTPS
   - Set up proper firewall rules

3. **Monitoring**
   - Set up logging
   - Monitor database connections
   - Track API performance

4. **Backup**
   - Regular database backups
   - Application configuration backup

## License

This project is licensed under the ISC License.

## Support

For support and questions, please contact the development team.
