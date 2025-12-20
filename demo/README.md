# Worker-Customer Management System

A comprehensive web application for managing workers and customers with role-based access control, featuring responsive design and a lightweight JSON database.

## Features

### 🔐 Authentication & Authorization
- User registration with role selection (Worker/Customer)
- Secure login with password hashing
- Role-based access control
- Password reset functionality

### 👷‍♂️ Worker Features
- **Profile Management**: Workers can create and edit their profiles
- **Skills Management**: Add/remove skills with interactive tags
- **Availability Status**: Set availability (Available/Busy/Unavailable)
- **Order Management**: View and manage incoming orders
- **Order Actions**: Accept orders and mark them as completed
- **Profile Information**: 
  - Full name, experience, hourly rate
  - Skills list with interactive management
  - Service description
  - Contact information

### 👤 Customer Features
- **Worker Discovery**: Browse available workers with responsive cards
- **Advanced Search**: Filter workers by skills, hourly rate, and availability
- **Worker Details**: View comprehensive worker information
- **Order Placement**: Place orders through a modal interface
- **Order Tracking**: View order history and status
- **Responsive Design**: Mobile-friendly interface

### 🎨 UI/UX Features
- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **Modern UI**: Clean, professional design with gradients and shadows
- **Interactive Elements**: Hover effects, smooth transitions
- **Card-based Layout**: Worker profiles displayed in attractive cards
- **Modal Dialogs**: Clean order placement interface
- **Status Indicators**: Visual status badges for orders and availability

### 🗄️ Database & API
- **Lightweight JSON Database**: No external database required
- **RESTful API**: Complete CRUD operations
- **Data Persistence**: All data stored in `database.json`
- **Error Handling**: Comprehensive error handling and validation

## Technology Stack

- **Backend**: Node.js with Express.js
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Database**: JSON file (lite database)
- **Authentication**: bcryptjs for password hashing
- **Styling**: Custom CSS with responsive design

## Installation & Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd demo
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Add sample workers (optional)**
   ```bash
   node add-sample-workers.js
   ```

4. **Start the server**
   ```bash
   node server.js
   ```

5. **Access the application**
   - Open `http://localhost:3000` in your browser
   - Register as a worker or customer
   - Start using the system!

## Deployment

### Backend (Node/Express)
- Host `server.js` on any Node-friendly platform (Render, Railway, Fly.io, Heroku, etc.).
- Set the environment variable `PORT` if required by the platform.
- Ensure persistent storage for `database.json` and `public/uploads/` if you need data to survive restarts. On ephemeral platforms, use a mounted volume or a managed DB.

Steps (Render example):
- Create a new Web Service from this repo.
- Build command: `npm install`.
- Start command: `npm start`.
- After deploy, note the service base URL, e.g. `https://your-backend.onrender.com`.

### Frontend (Netlify)
- The frontend is fully static in `public/`.
- A `netlify.toml` is included to publish `public/` and route unknown paths to `index.html`.
- Update API proxy in `netlify.toml` by replacing `YOUR-BACKEND-URL.example.com` with your actual backend URL.

Deploy steps:
1. Commit your changes and push to GitHub/GitLab.
2. In Netlify, create a new site from your repo.
3. Set build command to `npm run build` (not needed here) or leave empty, and publish directory to `public`.
4. Deploy. Netlify will serve the static site and proxy `/api/*` to your backend per `netlify.toml`.

### Local run parity
- When running locally, the frontend calls the same `/api/*` paths served by the Express server listening on `localhost:3000`.
- In production, Netlify proxies those paths to the hosted backend.

## API Endpoints

### Authentication
- `POST /api/register` - User registration
- `POST /api/login` - User login
- `POST /api/forgot-password` - Password reset request
- `POST /api/reset-password` - Password reset

### Worker Management
- `GET /api/workers` - Get all workers
- `GET /api/worker/:id` - Get specific worker profile
- `PUT /api/worker/:id` - Update worker profile

### Order Management
- `POST /api/orders` - Create new order
- `GET /api/orders/:userId` - Get user's orders
- `PUT /api/orders/:orderId` - Update order status

### User Management
- `GET /api/users` - Get all users (admin)

## Sample Data

The system includes sample workers with various skills:
- **John Smith** - Plumber (Plumbing, Pipe Repair, Drain Cleaning)
- **Sarah Johnson** - Electrician (Electrical Wiring, Circuit Installation)
- **Mike Wilson** - Carpenter (Carpentry, Cabinet Making, Woodworking)
- **Lisa Brown** - Cleaner (House Cleaning, Deep Cleaning, Window Cleaning)
- **David Miller** - Painter (Interior/Exterior Painting, Color Consultation)

## Usage Examples

### For Workers
1. Register with role "worker"
2. Login to access worker profile page
3. Fill in profile details (name, skills, experience, hourly rate)
4. Set availability status
5. View and manage incoming orders
6. Accept orders and mark them as completed

### For Customers
1. Register with role "customer"
2. Login to access customer dashboard
3. Browse available workers
4. Use search filters to find specific skills or price ranges
5. View worker details and reviews
6. Place orders through the modal interface
7. Track order status and history

## File Structure

```
demo/
├── server.js              # Main server file
├── database.json          # JSON database
├── package.json           # Dependencies
├── add-sample-workers.js  # Sample data script
├── test-api.js           # API testing script
├── public/               # Frontend files
│   ├── index.html        # Landing page
│   ├── login.html        # Login page
│   ├── register.html     # Registration page
│   ├── dashboard.html    # General dashboard
│   ├── worker-profile.html    # Worker profile page
│   ├── customer-dashboard.html # Customer dashboard
│   ├── styles.css        # Main stylesheet
│   ├── login.js          # Login functionality
│   └── register.js       # Registration functionality
└── README.md             # Documentation
```

## Security Features

- Password hashing with bcryptjs
- Input validation and sanitization
- Role-based access control
- Secure session management
- CORS protection

## Responsive Design

The application is fully responsive and works on:
- Desktop computers (1200px+)
- Tablets (768px - 1199px)
- Mobile devices (320px - 767px)

## Future Enhancements

- Real-time notifications
- Payment integration
- Rating and review system
- File upload for worker portfolios
- Advanced search filters
- Email notifications
- Admin dashboard
- Analytics and reporting

## License

This project is open source and available under the MIT License. 