# KPGU Student ID Card Management System

A comprehensive digital student ID card management system built with Next.js, featuring automated ID card generation, QR code integration, and admin management capabilities.

## 🌟 Features

### Student Management
- **Digital ID Cards**: Generate professional student ID cards with photos
- **QR Code Integration**: Each ID card includes a unique QR code for verification
- **Student Portal**: Students can view their digital ID cards online
- **Photo Upload**: Support for student photo uploads
- **Data Management**: Complete student information management

### Admin Panel
- **Student Registration**: Add, edit, and delete student records
- **Bulk Operations**: Manage multiple students efficiently
- **ID Card Generation**: Download printable ID cards (PNG format)
- **Search & Filter**: Find students quickly with advanced search
- **Dashboard Analytics**: Overview of total students and system stats

### ID Card Features
- **Professional Design**: Matches KPGU branding and colors
- **Front Side**: Logo, student photo, name, department, enrollment number, QR code
- **Back Side**: Parent information, addresses, usage instructions
- **High Quality**: Print-ready resolution for physical cards
- **Digital Verification**: QR codes link to online verification

## 🚀 Tech Stack

- **Frontend**: Next.js 14, React, TypeScript
- **Styling**: Tailwind CSS
- **Database**: SQLite with better-sqlite3
- **File Upload**: Multer for image handling
- **QR Codes**: qrcode library
- **Canvas**: HTML5 Canvas for ID card generation
- **Icons**: Lucide React

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- Modern web browser

## 🛠️ Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd kpgu-id-card-system
```

2. **Install dependencies**
```bash
npm install
# or
yarn install
```

3. **Set up the database**
```bash
npm run setup-db
```

4. **Start the development server**
```bash
npm run dev
# or
yarn dev
```

5. **Open your browser**
Navigate to `http://localhost:3000`

## 📁 Project Structure

```
├── app/
│   ├── admin/                 # Admin panel pages
│   ├── api/                   # API routes
│   │   ├── students/          # Student CRUD operations
│   │   ├── upload/            # File upload handling
│   │   └── generate-id/       # ID card generation
│   ├── student/               # Student portal
│   └── globals.css            # Global styles
├── lib/
│   ├── database.ts            # Database configuration
│   └── utils.ts               # Utility functions
├── public/
│   ├── images/                # Static images
│   │   ├── kpgu-logo.png      # University logo
│   │   └── logo.png           # App logo
│   └── uploads/               # Student photos
├── components/                # Reusable components
└── types/                     # TypeScript type definitions
```

## 🎯 Usage

### Admin Panel (`/admin`)

1. **Add Students**
   - Click "Add Student" button
   - Fill in student details
   - Upload student photo
   - Save the record

2. **Generate ID Cards**
   - Find the student in the list
   - Click the download icon
   - ID card will be generated and downloaded as PNG

3. **Manage Students**
   - Edit student information
   - Delete records
   - Search and filter students

### Student Portal (`/student`)

1. **View Digital ID**
   - Enter enrollment number
   - View digital ID card
   - QR code available for scanning

## 🎨 ID Card Design

### Front Side
- **Header**: KPGU logo and university name
- **Rainbow Stripe**: Colorful design element
- **Student Section**: Photo, name, department, enrollment details
- **QR Code**: For digital verification
- **Footer**: University branding

### Back Side
- **Parent Information**: Guardian details
- **Addresses**: Student and college addresses
- **Instructions**: How to use the digital ID card
- **Guidelines**: Manual verification and QR scanning info

## 🔧 Configuration

### Database Schema
```sql
CREATE TABLE students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  enrollment_number TEXT UNIQUE NOT NULL,
  department TEXT NOT NULL,
  course TEXT NOT NULL,
  admission_year INTEGER NOT NULL,
  photo_path TEXT,
  father_name TEXT,
  mother_name TEXT,
  student_address TEXT,
  college_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Environment Variables
Create a `.env.local` file:
```env
# Add any environment-specific configurations here
DATABASE_URL=./database.sqlite
UPLOAD_DIR=./public/uploads
```

## 📱 API Endpoints

### Students
- `GET /api/students` - Get all students
- `POST /api/students` - Create new student
- `PUT /api/students/[id]` - Update student
- `DELETE /api/students/[id]` - Delete student

### File Upload
- `POST /api/upload` - Upload student photo

### ID Card Generation
- `GET /api/generate-id/[enrollment]` - Generate ID card

## 🎨 Customization

### Colors and Styling
Edit `app/globals.css` and Tailwind classes to customize:
- University colors
- Card layout
- Typography
- Spacing

### Logo and Branding
Replace files in `public/images/`:
- `kpgu-logo.png` - University logo
- `logo.png` - Application logo

### ID Card Layout
Modify the canvas drawing logic in `/api/generate-id/` to:
- Change card dimensions
- Adjust element positions
- Modify colors and fonts
- Add new information fields

## 🚀 Deployment

### Vercel (Recommended)
1. Push code to GitHub
2. Connect repository to Vercel
3. Deploy automatically

### Manual Deployment
1. Build the application
```bash
npm run build
```

2. Start production server
```bash
npm start
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Contact the development team
- Check the documentation

## 🔄 Updates

### Version 1.0.0
- Initial release
- Basic student management
- ID card generation
- QR code integration
- Admin panel
- Student portal

---

**Made with ❤️ for KPGU Students**
