# ⚡ EvTracker

A web application for tracking electric vehicle charging sessions, specifically designed for Andersen A3 charger users on the Octopus Energy Intelligent Go tariff.

## Features

- 📊 **Dashboard** with charging statistics (total sessions, energy, costs)
- 📝 **Manual session logging** with detailed information
- 📈 **Charge history** with session details
- 💰 **Cost tracking** with customizable tariff rates
- 🔋 **State of Charge (SoC)** tracking
- 📱 **Responsive design** for desktop and mobile

## Quick Start

### Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/tomkerry47/EvTracker.git
cd EvTracker
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Open your browser and navigate to:
```
http://localhost:3000
```

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

- Sessions are stored in `data/sessions.json`
- File-based storage for simplicity
- Can be upgraded to a database (SQLite, PostgreSQL) for production use

## Configuration

### Default Tariff Rates

Edit the default tariff rate in `public/index.html`:
```html
<input type="number" id="tariffRate" step="0.01" min="0" value="7.5" required>
```

### Port Configuration

Change the port in `server.js` or use environment variable:
```bash
PORT=8080 npm start
```

## API Documentation

### Endpoints

#### GET `/api/sessions`
Returns all charging sessions

#### GET `/api/sessions/:id`
Returns a specific session

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

## Development

### Project Structure
```
EvTracker/
├── server.js           # Express server and API
├── package.json        # Dependencies
├── data/
│   └── sessions.json   # Data storage (auto-generated)
└── public/
    ├── index.html      # Main dashboard
    ├── styles.css      # Styling
    └── app.js          # Frontend JavaScript
```

### Adding Features

1. Backend changes: Edit `server.js`
2. Frontend changes: Edit files in `public/`
3. Restart server to apply changes

## Troubleshooting

### Server won't start
- Check if port 3000 is already in use
- Try a different port: `PORT=8080 npm start`

### Sessions not saving
- Check if `data/` directory exists
- Verify write permissions

### Can't access from other devices
- Server runs on localhost by default
- To access from network, bind to 0.0.0.0:
  ```javascript
  app.listen(PORT, '0.0.0.0', () => { ... });
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