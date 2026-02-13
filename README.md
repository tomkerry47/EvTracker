# ⚡ EvTracker

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/tomkerry47/EvTracker)

A web application for tracking electric vehicle charging sessions, specifically designed for Andersen A3 charger users on the Octopus Energy Intelligent Go tariff.

**Backend:** Supabase (PostgreSQL)  
**Frontend:** Vercel-ready static site  
**API:** Express.js serverless functions

## 🚀 Quick Start

**Ready to deploy?** See [QUICKSTART.md](./QUICKSTART.md) for a 10-minute setup guide!

## Features

- 📊 **Dashboard** with charging statistics (total sessions, energy, costs)
- 📝 **Manual session logging** with detailed information
- 📈 **Charge history** with session details
- 💰 **Cost tracking** with customizable tariff rates
- 🔋 **State of Charge (SoC)** tracking
- 📱 **Responsive design** for desktop and mobile
- ☁️ **Cloud-native** with Supabase backend and Vercel hosting

## Architecture

- **Backend**: Supabase PostgreSQL database with Row Level Security
- **API**: Express.js serverless functions (Vercel compatible)
- **Frontend**: Vanilla HTML/CSS/JavaScript (no build step required)
- **Hosting**: Designed for Vercel deployment

## Quick Start

### Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)
- A [Supabase](https://supabase.com/) account
- A [Vercel](https://vercel.com/) account (for deployment)

### Local Development Setup

1. Clone the repository:
```bash
git clone https://github.com/tomkerry47/EvTracker.git
cd EvTracker
```

2. Install dependencies:
```bash
npm install
```

3. Set up Supabase:
   - Create a new project at [supabase.com](https://supabase.com/)
   - Go to SQL Editor and run the schema from `supabase-schema.sql`
   - Get your project URL and anon key from Settings > API

4. Configure environment variables:
```bash
cp .env.example .env
```
Edit `.env` and add your Supabase credentials:
```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
PORT=3000
```

5. Start the development server:
```bash
npm start
```

6. Open your browser and navigate to:
```
http://localhost:3000
```

## Deployment

### Deploy to Vercel

See the detailed [DEPLOYMENT.md](./DEPLOYMENT.md) guide for step-by-step instructions.

**Quick Deploy:**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/tomkerry47/EvTracker)

1. Click the button above or go to [Vercel Dashboard](https://vercel.com/new)
2. Import your repository
3. Add environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
4. Deploy!

Your app will be live at `https://your-project.vercel.app`

## Usage

### Adding a Charging Session

1. Fill in the form with your charging session details:
   - **Date**: When the charge occurred
   - **Start/End Time**: Duration of the charging session
   - **Energy Added**: Amount of energy in kWh
   - **Start/End SoC**: State of Charge percentage (optional)
   - **Tariff Rate**: Cost per kWh (default: 7.5p for Intelligent Go)
   - **Cost**: Calculated automatically based on energy and tariff
   - **Notes**: Any additional information (optional)

2. Click "Add Session" to save

### Viewing Statistics

The dashboard displays:
- Total number of charging sessions
- Total energy consumed (kWh)
- Total cost (£)
- Average energy per session (kWh)

### Managing Sessions

- View all sessions in chronological order (newest first)
- Each session card shows detailed information
- Delete sessions using the "Delete" button

## Integration Options

### Andersen A3 Charger Integration

The Andersen A3 charger can be integrated in several ways:

#### Option 1: Manual Logging (Current Implementation)
- Log each charging session manually using the web interface
- Best for users who want simple tracking without automation

#### Option 2: Andersen API Integration (Future Enhancement)
The Andersen A3 offers an API that could be integrated:
- Requires Andersen account and API credentials
- Can automatically fetch charging session data
- Would require additional backend development

To implement API integration:
1. Sign up for Andersen API access
2. Add API credentials to environment variables
3. Implement polling service to fetch new sessions
4. Map Andersen data to EvTracker format

#### Option 3: OCPP Integration (Advanced)
- Andersen A3 supports OCPP (Open Charge Point Protocol)
- Requires OCPP server setup
- Most complex but most powerful option

### Octopus Energy Integration

#### Current Support
- Manual tariff rate entry (default: 7.5p/kWh for Intelligent Go off-peak)
- Cost calculation based on entered rates

#### Future Enhancement Options

1. **Octopus Energy API Integration**:
   - Fetch real-time tariff rates
   - Automatically categorize charges as peak/off-peak
   - Get actual consumption data from smart meter
   
   To implement:
   ```javascript
   // Add Octopus API credentials to .env
   OCTOPUS_API_KEY=your_api_key
   OCTOPUS_ACCOUNT_NUMBER=your_account_number
   ```

2. **Smart Tariff Detection**:
   - Intelligent Go off-peak: 23:30-05:30 (7.5p/kWh)
   - Smart charge windows: Variable based on Octopus scheduling
   - Peak rate: ~30p/kWh

## Data Storage

- **Database**: Supabase PostgreSQL database
- **Table**: `charging_sessions` with proper indexes for performance
- **Security**: Row Level Security (RLS) policies for data protection
- **Backups**: Automatic backups via Supabase (configurable)
- **Scalability**: Cloud-native, scales automatically with usage

See `supabase-schema.sql` for the complete database schema.

## Configuration

### Environment Variables

Required environment variables (set in `.env` for local, Vercel settings for production):

```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
PORT=3000  # Optional, for local development
```

### Default Tariff Rates

Edit the default tariff rate in `public/index.html`:
```html
<input type="number" id="tariffRate" step="0.01" min="0" value="7.5" required>
```

## API Documentation

The API is built with Express.js and can be deployed as Vercel serverless functions.

### Endpoints

#### GET `/api/sessions`
Returns all charging sessions, ordered by creation date (newest first)

**Response:**
```json
[
  {
    "id": "1234567890-abc123",
    "date": "2024-02-13",
    "startTime": "23:30",
    "endTime": "05:30",
    "energyAdded": 45.5,
    "startSoC": 20,
    "endSoC": 80,
    "tariffRate": 7.5,
    "cost": 3.41,
    "notes": "Overnight charge",
    "createdAt": "2024-02-13T23:30:00Z"
  }
]
```

#### GET `/api/sessions/:id`
Returns a specific session by ID

#### POST `/api/sessions`
Create a new session

**Request body:**
```json
{
  "date": "2024-02-13",
  "startTime": "23:30",
  "endTime": "05:30",
  "energyAdded": 45.5,
  "startSoC": 20,
  "endSoC": 80,
  "tariffRate": 7.5,
  "cost": 3.41,
  "notes": "Overnight charge"
}
```

#### PUT `/api/sessions/:id`
Update an existing session

#### DELETE `/api/sessions/:id`
Delete a session

#### GET `/api/stats`
Returns aggregated statistics

**Response:**
```json
{
  "totalSessions": 10,
  "totalEnergy": 450.5,
  "totalCost": 33.79,
  "averageEnergy": 45.05
}
```

## Development

### Project Structure
```
EvTracker/
├── server.js              # Express API server (Vercel serverless ready)
├── package.json           # Dependencies and scripts
├── vercel.json            # Vercel deployment configuration
├── supabase-schema.sql    # Database schema for Supabase
├── DEPLOYMENT.md          # Detailed deployment guide
├── .env.example           # Environment variables template
└── public/                # Static frontend files
    ├── index.html         # Main dashboard
    ├── styles.css         # Styling
    └── app.js             # Frontend JavaScript
```

### Technology Stack

- **Backend Framework**: Express.js
- **Database**: Supabase (PostgreSQL)
- **Database Client**: @supabase/supabase-js
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Hosting**: Vercel (serverless functions)
- **Environment**: dotenv for local development

### Adding Features

1. **Backend changes**: Edit `server.js`
   - Add new API endpoints
   - Modify database queries
   - Update data transformations

2. **Frontend changes**: Edit files in `public/`
   - Update UI in `index.html`
   - Add styles to `styles.css`
   - Modify logic in `app.js`

3. **Database changes**: Update `supabase-schema.sql`
   - Add new tables or columns
   - Create indexes
   - Update RLS policies

4. **Deploy**: Push to Git (auto-deploys on Vercel)

## Troubleshooting

### Server won't start
- **Missing credentials**: Check that `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set in `.env`
- **Port in use**: Try a different port: `PORT=8080 npm start`
- **Dependencies**: Run `npm install` to ensure all packages are installed

### Database connection errors
- **Invalid credentials**: Verify Supabase URL and anon key are correct
- **Table doesn't exist**: Run the SQL schema from `supabase-schema.sql` in Supabase SQL Editor
- **Network issues**: Check your internet connection and Supabase project status

### Sessions not saving
- **Database permissions**: Verify RLS policies in Supabase allow inserts
- **Invalid data**: Check browser console for validation errors
- **API errors**: Check server logs for error messages

### Deployment issues on Vercel
- **Build fails**: Ensure all dependencies are in `package.json`
- **Environment variables**: Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in Vercel project settings
- **Function timeout**: Check Vercel function logs for errors
- **Routes not working**: Verify `vercel.json` configuration is correct

### API returns 500 errors
- Check Vercel function logs in deployment dashboard
- Verify environment variables are set correctly
- Ensure database table schema matches the code
- Check Supabase project status and database connection

## Migration from File-based Storage

If you're migrating from the previous file-based version:

1. Export your existing data from `data/sessions.json`
2. Set up Supabase and run the schema
3. Import data via SQL:

```sql
INSERT INTO charging_sessions (id, date, start_time, end_time, energy_added, start_soc, end_soc, tariff_rate, cost, notes)
VALUES ('your-id', '2024-02-13', '23:30', '05:30', 45.5, 20, 80, 7.5, 3.41, 'Notes');
```

Or use the API to bulk import:
```javascript
// Script to import from JSON
const sessions = require('./data/sessions.json');
for (const session of sessions) {
  await fetch('https://your-app.vercel.app/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(session)
  });
}
  ```

## Future Enhancements

- [ ] Andersen A3 API integration
- [ ] Octopus Energy API integration
- [ ] Export data to CSV/Excel
- [ ] Charts and graphs for historical data
- [ ] Mobile app
- [ ] Database backend (PostgreSQL/SQLite)
- [ ] User authentication
- [ ] Multi-vehicle support
- [ ] Smart charge scheduling

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License

## Support

For issues, questions, or feature requests, please open an issue on GitHub.