"use client"

import type React from "react"
import QRCode from 'qrcode'

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  UserPlus,
  Users,
  Activity,
  Copy,
  Check,
  Edit,
  Trash2,
  Save,
  X,
  LogOut,
  RefreshCw,
  Database,
  Upload,
  ImageIcon,
  Camera,
  Search,
  Calendar as CalendarIcon,
  History,
  Download,
  QrCode,
  Eye,
} from "lucide-react"
import { dbStore, type Student } from "@/lib/database-store"
import { supabase } from "@/lib/supabase"

export default function AdminPanel() {
  const [students, setStudents] = useState<Student[]>([])
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [copiedText, setCopiedText] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [dataSource, setDataSource] = useState<string>("local")
  const [databaseConnected, setDatabaseConnected] = useState(false)
  const [storageInfo, setStorageInfo] = useState({ mode: "Local", studentsCount: 0, entriesCount: 0 })
  const [stats, setStats] = useState({
    totalStudents: 0,
    todayEntries: 0,
    todayExits: 0,
    totalEntries: 0,
  })
  const [showHistoryCalendar, setShowHistoryCalendar] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [calendarData, setCalendarData] = useState<{[key: string]: {entries: number, exits: number}}>({})
  const [selectedDateEntries, setSelectedDateEntries] = useState<any[]>([])
  const [loadingCalendar, setLoadingCalendar] = useState(false)
  const [calendarSearchQuery, setCalendarSearchQuery] = useState("")
  const [showStudentDetails, setShowStudentDetails] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [studentEntries, setStudentEntries] = useState<any[]>([])
  const [loadingEntries, setLoadingEntries] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [entriesPerPage] = useState(4)
  const [newStudent, setNewStudent] = useState({
    name: "",
    phone: "",
    email: "",
    class: "",
    department: "",
    schedule: "",
    address: "",
    image: "", // Will store base64 image
  })
  const [searchQuery, setSearchQuery] = useState("")
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    // Check if admin is logged in
    if (typeof window !== "undefined") {
      const adminLoggedIn = localStorage.getItem("adminLoggedIn")
      if (!adminLoggedIn) {
        router.push("/")
        return
      }
    }

    setIsAuthenticated(true)
    checkDatabaseConnection()
    loadData()
  }, [router])

  // Separate function to refresh only stats (not full page)
  const refreshStats = async () => {
    try {
      console.log("🔄 Refreshing stats from shared MongoDB database...")

      let allEntries = []
      let todayEntries = []
      let studentsData = []
      let dataSource = "mongodb"

      try {
        // Use local API which connects to shared MongoDB
        console.log("🔍 Fetching from shared MongoDB via local API...")
        const [localStudentsRes, localEntriesRes] = await Promise.all([
          fetch('/api/students'),
          fetch('/api/entries')
        ])

        if (localStudentsRes.ok && localEntriesRes.ok) {
          studentsData = await localStudentsRes.json()
          allEntries = await localEntriesRes.json()
          dataSource = "mongodb"
          console.log("✅ Data fetched from shared MongoDB database")
        } else {
          throw new Error("MongoDB API not available")
        }
      } catch (apiError) {
        console.log("⚠️ API not available, using database store fallback...")
        // Fallback to database store
        allEntries = await dbStore.getAllEntries()
        todayEntries = await dbStore.getTodayEntries()
        studentsData = await dbStore.getStudents()
        dataSource = "fallback"
      }

      // Filter today's entries if we got data from API
      if (dataSource !== "fallback") {
        const today = new Date().toDateString()
        todayEntries = allEntries.filter((entry: any) => {
          const entryDate = new Date(entry.entryTime || entry.entry_time).toDateString()
          return entryDate === today
        })
      }

      console.log("📊 Raw data:", {
        source: dataSource,
        allEntries: allEntries.length,
        todayEntries: todayEntries.length,
        todayEntriesData: todayEntries,
        students: studentsData.length
      })

      // Debug: Show sample entry data
      if (allEntries.length > 0) {
        console.log("📝 Sample entry:", allEntries[0])
      }
      if (todayEntries.length > 0) {
        console.log("📅 Sample today entry:", todayEntries[0])
      }

      // Count entries: all records with entry_time today (regardless of exit status)
      const entryCount = todayEntries.length

      // Count exits: records that have both entry_time and exit_time today
      const exitCount = todayEntries.filter((e: any) => {
        return e.exitTime || e.exit_time // Has exit time
      }).length

      setStats({
        totalStudents: studentsData.length,
        todayEntries: entryCount,
        todayExits: exitCount,
        totalEntries: allEntries.length,
      })

      setDataSource(dataSource)
      setLastUpdated(new Date())
      console.log("✅ Stats refreshed:", {
        source: dataSource,
        totalStudents: studentsData.length,
        todayEntries: entryCount,
        todayExits: exitCount,
        totalActivity: entryCount + exitCount,
        allEntries: allEntries.length,
        timestamp: new Date().toLocaleTimeString()
      })
    } catch (error) {
      console.error("❌ Error refreshing stats:", error)
    }
  }

  // Auto-reload only stats every 5 seconds (not full page)
  useEffect(() => {
    if (!isAuthenticated) return

    const interval = setInterval(() => {
      refreshStats() // Only refresh stats, not full page
    }, 5000) // 5 seconds

    return () => clearInterval(interval)
  }, [isAuthenticated])

  const checkDatabaseConnection = async () => {
    try {
      // Check if we can connect to MongoDB via API
      const studentsRes = await fetch('/api/students')
      const entriesRes = await fetch('/api/entries')

      if (studentsRes.ok && entriesRes.ok) {
        const students = await studentsRes.json()
        const entries = await entriesRes.json()
        setDatabaseConnected(true)
        setStorageInfo({
          mode: "MongoDB Cloud",
          studentsCount: students.length,
          entriesCount: entries.length
        })
        console.log("✅ MongoDB connection verified")
      } else {
        throw new Error("API not responding")
      }
    } catch (error) {
      console.log("⚠️ MongoDB not available, using local storage")
      setDatabaseConnected(false)
      const storageInfo = await dbStore.getStorageInfo()
      setStorageInfo(storageInfo)
    }
  }

  const loadData = async () => {
    try {
      setLoading(true)

      // Load students from local database (for admin management)
      const studentsData = await dbStore.getStudents()
      setStudents(studentsData)

      // Load stats from cardstation if available
      await refreshStats()

      const storageInfo = await dbStore.getStorageInfo()
      setStorageInfo(storageInfo)
    } catch (error) {
      console.error("Error loading data:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = () => {
    loadData() // Full page refresh
  }

  // Function to fetch student entry history
  const fetchStudentEntries = async (studentId: string) => {
    setLoadingEntries(true)
    try {
      const response = await fetch(`/api/entries?studentId=${studentId}`)
      if (response.ok) {
        const entries = await response.json()
        console.log("Fetched entries:", entries.length, entries)
        setStudentEntries(entries)
      } else {
        console.error("Failed to fetch student entries")
        setStudentEntries([])
      }
    } catch (error) {
      console.error("Error fetching student entries:", error)
      setStudentEntries([])
    } finally {
      setLoadingEntries(false)
    }
  }

  // Function to show student details modal
  const showStudentDetailsModal = async (student: Student) => {
    setSelectedStudent(student)
    setShowStudentDetails(true)
    setCurrentPage(1) // Reset to first page
    await fetchStudentEntries(student.id)
  }



  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("adminLoggedIn")
      localStorage.removeItem("adminUsername")
    }
    router.push("/")
  }



  // Filter students based on search query
  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.application_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.class.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.department?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    student.phone.includes(searchQuery)
  )

  // Handle image file selection
  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file (JPG, PNG, GIF, etc.)")
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("Image size should be less than 5MB")
      return
    }

    setImageFile(file)

    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      setImagePreview(result)
      setNewStudent({ ...newStudent, image: result })
    }
    reader.readAsDataURL(file)
  }

  // Remove selected image
  const removeImage = () => {
    setImageFile(null)
    setImagePreview(null)
    setNewStudent({ ...newStudent, image: "" })
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  // Take photo using camera
  const takePhoto = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })

      // Create a video element to capture the stream
      const video = document.createElement("video")
      video.srcObject = stream
      video.autoplay = true

      // Create a modal or popup to show camera feed
      const modal = document.createElement("div")
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
      `

      const container = document.createElement("div")
      container.style.cssText = `
        background: white;
        padding: 20px;
        border-radius: 10px;
        text-align: center;
      `

      const canvas = document.createElement("canvas")
      const captureBtn = document.createElement("button")
      captureBtn.textContent = "Capture Photo"
      captureBtn.style.cssText = `
        background: #3b82f6;
        color: white;
        padding: 10px 20px;
        border: none;
        border-radius: 5px;
        margin: 10px;
        cursor: pointer;
      `

      const cancelBtn = document.createElement("button")
      cancelBtn.textContent = "Cancel"
      cancelBtn.style.cssText = `
        background: #6b7280;
        color: white;
        padding: 10px 20px;
        border: none;
        border-radius: 5px;
        margin: 10px;
        cursor: pointer;
      `

      container.appendChild(video)
      container.appendChild(document.createElement("br"))
      container.appendChild(captureBtn)
      container.appendChild(cancelBtn)
      modal.appendChild(container)
      document.body.appendChild(modal)

      // Capture photo
      captureBtn.onclick = () => {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext("2d")
        ctx?.drawImage(video, 0, 0)

        const imageData = canvas.toDataURL("image/jpeg", 0.8)
        setImagePreview(imageData)
        setNewStudent({ ...newStudent, image: imageData })

        // Stop camera and close modal
        stream.getTracks().forEach((track) => track.stop())
        document.body.removeChild(modal)
      }

      // Cancel
      cancelBtn.onclick = () => {
        stream.getTracks().forEach((track) => track.stop())
        document.body.removeChild(modal)
      }
    } catch (error) {
      alert("Camera access denied or not available")
    }
  }

  const validateForm = () => {
    if (!newStudent.name.trim()) {
      alert("Student name is required")
      return false
    }
    if (!newStudent.phone.trim()) {
      alert("Phone number is required")
      return false
    }
    if (newStudent.phone.length !== 10 || !/^\d+$/.test(newStudent.phone)) {
      alert("Phone number must be exactly 10 digits")
      return false
    }
    if (!newStudent.class) {
      alert("Class selection is required")
      return false
    }
    if (!newStudent.image) {
      alert("Student photo is required. Please upload an image or take a photo.")
      return false
    }
    return true
  }

  const handleAddStudent = async () => {
    if (!validateForm()) return

    // Check if phone number already exists
    const existingStudent = students.find((s) => s.phone === newStudent.phone)
    if (existingStudent) {
      alert("Phone number already exists!")
      return
    }

    setLoading(true)
    try {
      const applicationNumber = dbStore.generateApplicationNumber()
      const student = await dbStore.addStudent({
        ...newStudent,
        application_number: applicationNumber,
        department: newStudent.department || "Diploma (CSE)", // Ensure department is set
        image_url: newStudent.image, // Store base64 image
      })

      await loadData()
      resetForm()

      alert(
        `Student Added Successfully!\n\nName: ${student.name}\nEnrollment Number: ${applicationNumber}\nPhone: ${student.phone}\n\nPlease provide Enrollment Number and Phone Number to the student for login.\n\nData saved in ${storageInfo.mode} storage.`,
      )
    } catch (error) {
      alert("Error adding student. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleEditStudent = (student: Student) => {
    setEditingStudent(student)
    setNewStudent({
      name: student.name,
      phone: student.phone,
      email: student.email || "",
      class: student.class,
      department: student.department || "",
      schedule: student.schedule || "",
      address: student.address || "",
      image: student.image_url || "",
    })
    setImagePreview(student.image_url || null)
    setShowAddForm(false)
  }

  const handleUpdateStudent = async () => {
    if (!validateForm() || !editingStudent) return

    // Check if phone number already exists (excluding current student)
    const existingStudent = students.find((s) => s.phone === newStudent.phone && s.id !== editingStudent.id)
    if (existingStudent) {
      alert("Phone number already exists!")
      return
    }

    setLoading(true)
    try {
      console.log("Updating student:", editingStudent.id)
      console.log("Update data:", {
        name: newStudent.name,
        phone: newStudent.phone,
        email: newStudent.email || null,
        class: newStudent.class,
        department: newStudent.department || null,
        schedule: newStudent.schedule || null,
        address: newStudent.address || null,
        image_url: newStudent.image,
      })

      await dbStore.updateStudent(editingStudent.id, {
        name: newStudent.name,
        phone: newStudent.phone,
        email: newStudent.email || null,
        class: newStudent.class,
        department: newStudent.department || "Diploma (CSE)", // Ensure department is set
        schedule: newStudent.schedule || null,
        address: newStudent.address || null,
        image_url: newStudent.image,
      })

      await loadData()
      resetForm()
      alert(`Student updated successfully!\n\nData saved in ${storageInfo.mode} storage.`)
    } catch (error) {
      console.error("Update student error:", error)
      alert(`Error updating student: ${error instanceof Error ? error.message : 'Please try again.'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteStudent = async (student: Student) => {
    try {
      // First, get the student's entry history to show in confirmation
      const studentEntries = await dbStore.getStudentEntries(student.id)
      const entryCount = studentEntries.length

      const confirmMessage = `⚠️ DELETE STUDENT CONFIRMATION ⚠️\n\nStudent: ${student.name}\nEnrollment Number: ${student.application_number}\nPhone: ${student.phone}\n\n📊 DATA TO BE PERMANENTLY DELETED:\n• Student profile and photo\n• ${entryCount} entry/exit history records\n• All calendar activity data\n• All associated information\n\n❌ This action CANNOT be undone!\n❌ Student will lose ALL access to the system!\n❌ ALL history will be permanently removed!\n\nAre you absolutely sure you want to delete this student and ALL their data?`

      if (confirm(confirmMessage)) {
        setLoading(true)

        try {
          // Delete student (backend will handle entries deletion automatically)
          console.log(`🗑️ Deleting student ${student.name} and all associated data...`)
          await dbStore.deleteStudent(student.id)
          console.log(`✅ Student and all data deleted`)

          // Force refresh all data including calendar
          console.log("🔄 Refreshing all data after student deletion...")
          await loadData()

          // Force clear calendar data and reload
          console.log("🗓️ Force clearing and reloading calendar data...")
          setCalendarData({}) // Clear existing calendar data
          setSelectedDateEntries([]) // Clear selected date entries
          await loadCalendarData() // Reload calendar data from database

          console.log("✅ All data refreshed after deletion")

          alert(`✅ STUDENT COMPLETELY DELETED!\n\n👤 Student: ${student.name}\n📱 Enrollment Number: ${student.application_number}\n\n🗑️ DELETED DATA:\n• Student profile and photo\n• ${entryCount} entry/exit history records\n• All calendar activity\n• All system access\n\n💾 Database updated successfully.\n\n⚠️ This student can no longer access the system or view any history.`)
        } catch (error) {
          console.error("Error deleting student:", error)
          alert(`❌ Failed to delete student: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }
    } catch (error) {
      console.error("Error deleting student:", error)
      alert(`❌ Error deleting student!\n\nFailed to delete ${student.name}.\nPlease try again or contact technical support.`)
    } finally {
      setLoading(false)
    }
  }

  const generateQRCodeWithWatermark = async (text: string, logoUrl: string): Promise<string> => {
    try {
      // Generate basic QR code
      const qrDataUrl = await QRCode.toDataURL(text, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })

      // Create canvas to combine QR code with watermark
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      canvas.width = 200
      canvas.height = 200

      return new Promise((resolve, reject) => {
        const qrImg = new Image()
        qrImg.onload = () => {
          // Draw QR code
          ctx.drawImage(qrImg, 0, 0, 200, 200)

          // Load and draw watermark logo
          const logoImg = new Image()
          logoImg.crossOrigin = 'anonymous'

          logoImg.onload = () => {
            console.log("🎯 QR watermark logo loaded successfully, dimensions:", logoImg.width, "x", logoImg.height)

            // Draw semi-transparent watermark in center
            const logoSize = 40
            const x = (200 - logoSize) / 2
            const y = (200 - logoSize) / 2

            // Add white background circle for logo
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
            ctx.beginPath()
            ctx.arc(100, 100, logoSize/2 + 5, 0, 2 * Math.PI)
            ctx.fill()

            // Draw logo
            ctx.globalAlpha = 0.8
            ctx.drawImage(logoImg, x, y, logoSize, logoSize)
            ctx.globalAlpha = 1.0

            console.log("✅ QR code watermark logo applied successfully")
            resolve(canvas.toDataURL())
          }

          logoImg.onerror = (error) => {
            console.error("❌ QR watermark logo failed to load from /images/kpgu-logo.png:", error)
            console.log("🔄 Returning QR code without watermark")
            // If logo fails to load, just return QR code without watermark
            resolve(qrDataUrl)
          }

          logoImg.src = logoUrl
        }

        qrImg.onerror = () => {
          reject(new Error('Failed to load QR code'))
        }

        qrImg.src = qrDataUrl
      })
    } catch (error) {
      console.error('Error generating QR code with watermark:', error)
      // Fallback to simple QR code
      return await QRCode.toDataURL(text, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      })
    }
  }

  const generateQRCode = async (text: string): Promise<string> => {
    // Use the local KPGU logo as watermark
    const logoUrl = "/images/kpgu-logo.png"

    try {
      // Try to use the actual college logo
      return await generateQRCodeWithWatermark(text, logoUrl)
    } catch (error) {
      console.error('Failed to load college logo for QR watermark:', error)
      // Fallback to SVG logo if the image fails to load
      const fallbackLogoDataUrl = "data:image/svg+xml;base64," + btoa(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
          <defs>
            <radialGradient id="bgGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" style="stop-color:#B91C1C;stop-opacity:1" />
              <stop offset="100%" style="stop-color:#7F1D1D;stop-opacity:1" />
            </radialGradient>
          </defs>

          <!-- Background circle -->
          <circle cx="100" cy="100" r="90" fill="url(#bgGrad)" stroke="#fff" stroke-width="4"/>

          <!-- College emblem design -->
          <g transform="translate(100,100)">
            <!-- Central shield -->
            <path d="M-25,-40 L25,-40 L30,-20 L25,40 L-25,40 L-30,-20 Z" fill="#fff" stroke="#B91C1C" stroke-width="2"/>

            <!-- Text -->
            <text x="0" y="0" text-anchor="middle" fill="#B91C1C" font-family="Arial" font-size="12" font-weight="bold">KPGU</text>
            <text x="0" y="15" text-anchor="middle" fill="#B91C1C" font-family="Arial" font-size="8">VADODARA</text>
          </g>
        </svg>
      `)

      return await generateQRCodeWithWatermark(text, fallbackLogoDataUrl)
    }
  }

  const downloadIDCard = async (student: Student) => {
    try {
      setLoading(true)

      // Debug: Check student data
      console.log("🎓 Generating ID card for student:", student.name)
      console.log("📊 Student data:", {
        name: student.name,
        department: student.department,
        class: student.class,
        application_number: student.application_number
      })

      // Generate QR code with enrollment number (for display and scanning)
      const qrCodeDataUrl = await generateQRCode(student.application_number)

      // Create canvas for front side (ID Card)
      const frontCanvas = document.createElement('canvas')
      const frontCtx = frontCanvas.getContext('2d')!

      // Set canvas size for front side (portrait orientation like the image)
      const cardWidth = 400
      const cardHeight = 650
      frontCanvas.width = cardWidth
      frontCanvas.height = cardHeight

      // Fill white background
      frontCtx.fillStyle = '#FFFFFF'
      frontCtx.fillRect(0, 0, cardWidth, cardHeight)

      // Draw proper green border
      frontCtx.strokeStyle = '#28a745'
      frontCtx.lineWidth = 3
      frontCtx.strokeRect(1.5, 1.5, cardWidth - 3, cardHeight - 3)

      // Draw your custom logo from public/logo.png
      const drawFallbackLogo = () => {
        // Clear header area first
        frontCtx.fillStyle = '#FFFFFF'
        frontCtx.fillRect(0, 0, cardWidth, 120)

        // Load and draw your custom logo
        const logoImg = new Image()
        logoImg.onload = () => {
          // Calculate proper size and position for logo
          const maxWidth = 140
          const maxHeight = 100

          // Maintain aspect ratio
          const imgAspectRatio = logoImg.naturalWidth / logoImg.naturalHeight
          let drawWidth = maxWidth
          let drawHeight = maxHeight

          if (imgAspectRatio > maxWidth / maxHeight) {
            drawHeight = maxWidth / imgAspectRatio
          } else {
            drawWidth = maxHeight * imgAspectRatio
          }

          // Center the logo
          const logoX = (cardWidth - drawWidth) / 2
          const logoY = (120 - drawHeight) / 2 + 10

          frontCtx.drawImage(logoImg, logoX, logoY, drawWidth, drawHeight)
          console.log('✅ Fallback logo drawn successfully')
        }

        logoImg.onerror = () => {
          console.error('❌ Fallback logo failed, using text')
          // If image fails, show simple text
          frontCtx.fillStyle = '#000000'
          frontCtx.font = 'bold 16px Arial'
          frontCtx.textAlign = 'center'
          frontCtx.fillText('LOGO NOT FOUND', cardWidth / 2, 60)
        }

        logoImg.src = '/logo.png'
      }

      // Draw university logo function with your specific image
      const drawUniversityLogo = async () => {
        // Clear header area first
        frontCtx.fillStyle = '#FFFFFF'
        frontCtx.fillRect(0, 0, cardWidth, 120)

        // Create image element
        const logoImg = new Image()

        // Set up promise for image loading
        const imageLoadPromise = new Promise((resolve, reject) => {
          logoImg.onload = () => {
            console.log('✅ Image loaded successfully!')
            resolve(logoImg)
          }
          logoImg.onerror = (error) => {
            console.error('❌ Image failed to load:', error)
            reject(error)
          }
        })

        // Set image source
        logoImg.src = '/logo.png'
        console.log('🔄 Loading image from:', logoImg.src)

        try {
          // Wait for image to load
          await imageLoadPromise

          // Draw the image in proper header position like original
          const logoWidth = 300  // Proper size for header
          const logoHeight = 80   // Proper height for header
          const logoX = (cardWidth - logoWidth) / 2
          const logoY = 15  // Proper header position

          frontCtx.drawImage(logoImg, logoX, logoY, logoWidth, logoHeight)
          console.log('✅ Image drawn on canvas successfully!')

          // Border removed as requested

        } catch (error) {
          console.error('❌ Failed to load/draw image:', error)
          // Draw error indicator
          frontCtx.fillStyle = '#FF0000'
          frontCtx.fillRect(150, 30, 100, 60)
          frontCtx.fillStyle = '#FFFFFF'
          frontCtx.font = 'bold 12px Arial'
          frontCtx.textAlign = 'center'
          frontCtx.fillText('IMAGE FAILED', 200, 65)
        }
      }

      // Draw header section with university logo
      const drawHeader = async () => {
        // Draw the university logo (includes white background)
        await drawUniversityLogo()
      }

      await drawHeader()

      // Draw colorful stripe exactly like original - right below logo
      const drawStripe = () => {
        const stripeHeight = 6
        const stripeY = 100  // Right below logo
        // Rainbow colors like original: red, orange, yellow, green, blue, indigo, violet
        const colors = ['#FF0000', '#FF8000', '#FFFF00', '#00FF00', '#0080FF', '#4B0082', '#8B00FF']
        const stripeWidth = (cardWidth - 30) / colors.length

        colors.forEach((color, index) => {
          frontCtx.fillStyle = color
          frontCtx.fillRect(15 + (index * stripeWidth), stripeY, stripeWidth, stripeHeight)
        })
      }

      drawStripe()

      // Draw photo section exactly like target image
      const drawPhotoSection = () => {
        // Photo section background like target (#d9e8f4) - full width from stripe to bottom stripe
        const sectionX = 15
        const sectionY = 120
        const sectionWidth = cardWidth - 30
        const sectionHeight = cardHeight - 140 // Full height minus top/bottom margins

        // Draw light blue background exactly like target
        frontCtx.fillStyle = '#d9e8f4'
        frontCtx.fillRect(sectionX, sectionY, sectionWidth, sectionHeight)

        // Draw student photo - proper size like original
        const photoX = (cardWidth - 110) / 2
        const photoY = 140
        const photoWidth = 110
        const photoHeight = 130

        if (student.image_url) {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => {
            // Draw photo centered like target
            frontCtx.drawImage(img, photoX, photoY, photoWidth, photoHeight)
          }
          img.src = student.image_url
        } else {
          // Draw placeholder
          frontCtx.fillStyle = '#CCCCCC'
          frontCtx.fillRect(photoX, photoY, photoWidth, photoHeight)
          frontCtx.fillStyle = '#666666'
          frontCtx.font = '12px Arial'
          frontCtx.textAlign = 'center'
          frontCtx.fillText('Photo', photoX + photoWidth/2, photoY + photoHeight/2)
        }
      }

      drawPhotoSection()

      // Draw student information exactly like target image
      const drawStudentInfo = () => {
        frontCtx.textAlign = 'center'

        // Student name - proper position like original
        frontCtx.fillStyle = '#000000'
        frontCtx.font = 'bold 22px Arial'
        frontCtx.fillText(student.name.toUpperCase(), cardWidth / 2, 290)

        // Course/Department - proper position like original
        frontCtx.fillStyle = '#000000'
        frontCtx.font = '15px Arial'
        const departmentText = student.department && student.department.trim() !== '' ? student.department : 'B-Tech (CSE)'
        frontCtx.fillText(departmentText, cardWidth / 2, 315)

        // Enrollment Number - exactly like target image
        frontCtx.fillStyle = '#000000'
        frontCtx.font = '16px Arial'
        frontCtx.textAlign = 'left'

        // Calculate text positions for proper alignment
        const enrollStartX = cardWidth / 2 - 80
        frontCtx.fillText('Enrol. ', enrollStartX, 345)

        // Measure text width for proper positioning
        const enrollWidth = frontCtx.measureText('Enrol. ').width

        // Draw "No." with blue color and underline
        frontCtx.fillStyle = '#0645AD'
        frontCtx.fillText('No.', enrollStartX + enrollWidth, 345)

        // Draw underline for "No."
        const noWidth = frontCtx.measureText('No.').width
        frontCtx.strokeStyle = '#0645AD'
        frontCtx.lineWidth = 1
        frontCtx.beginPath()
        frontCtx.moveTo(enrollStartX + enrollWidth, 347)
        frontCtx.lineTo(enrollStartX + enrollWidth + noWidth, 347)
        frontCtx.stroke()

        // Continue with enrollment number
        frontCtx.fillStyle = '#000000'
        frontCtx.fillText(` : ${student.application_number}`, enrollStartX + enrollWidth + noWidth, 345)

        // Admission Year - exactly like target image
        frontCtx.fillStyle = '#000000'
        frontCtx.font = '16px Arial'

        const admissionStartX = cardWidth / 2 - 80
        frontCtx.fillText('ADMISSION ', admissionStartX, 370)

        // Measure text width for proper positioning
        const admissionWidth = frontCtx.measureText('ADMISSION ').width

        // Draw "YEAR" with blue color and underline
        frontCtx.fillStyle = '#0645AD'
        frontCtx.fillText('YEAR', admissionStartX + admissionWidth, 370)

        // Draw underline for "YEAR"
        const yearWidth = frontCtx.measureText('YEAR').width
        frontCtx.strokeStyle = '#0645AD'
        frontCtx.lineWidth = 1
        frontCtx.beginPath()
        frontCtx.moveTo(admissionStartX + admissionWidth, 372)
        frontCtx.lineTo(admissionStartX + admissionWidth + yearWidth, 372)
        frontCtx.stroke()

        // Continue with year
        frontCtx.fillStyle = '#000000'
        frontCtx.fillText(' : 2025', admissionStartX + admissionWidth + yearWidth, 370)
      }

      drawStudentInfo()

      // Draw QR Code properly positioned
      const drawQRCode = () => {
        return new Promise<void>((resolve) => {
          const qrImg = new Image()
          qrImg.onload = () => {
            // QR code - increased size for better visibility
            const qrSize = 110  // Increased from 90 to 110
            const qrX = (cardWidth - qrSize) / 2
            const qrY = 390

            frontCtx.drawImage(qrImg, qrX, qrY, qrSize, qrSize)

            // Enrollment number below QR - like original
            frontCtx.fillStyle = '#000000'
            frontCtx.font = 'bold 13px Arial'
            frontCtx.textAlign = 'center'
            frontCtx.fillText(student.application_number, cardWidth / 2, qrY + qrSize + 18)

            // Draw bottom colorful stripe
            drawBottomStripe()

            resolve()
          }
          qrImg.src = qrCodeDataUrl
        })
      }

      // Draw university name above colorful stripe
      const drawBottomStripe = () => {
        // University name section above the stripe
        const universityHeight = 30
        const universityY = cardHeight - 50
        const margin = 15  // Same margin as top stripe

        // Green background for university name - with margins like top stripe
        frontCtx.fillStyle = '#4CAF50'
        frontCtx.fillRect(margin, universityY, cardWidth - (margin * 2), universityHeight)

        // University name text
        frontCtx.fillStyle = '#FFFFFF'
        frontCtx.font = 'bold 12px Arial'
        frontCtx.textAlign = 'center'
        frontCtx.fillText('DRS. KIRAN & PALLAVI PATEL GLOBAL UNIVERSITY', cardWidth / 2, universityY + 20)

        // Add colorful rainbow stripe below the green box - same as top stripe with margins
        const bottomStripeHeight = 6
        const bottomStripeY = universityY + universityHeight  // Right below green box
        // Rainbow colors like original: red, orange, yellow, green, blue, indigo, violet
        const colors = ['#FF0000', '#FF8000', '#FFFF00', '#00FF00', '#0080FF', '#4B0082', '#8B00FF']
        const stripeWidth = (cardWidth - (margin * 2)) / colors.length

        colors.forEach((color, index) => {
          frontCtx.fillStyle = color
          frontCtx.fillRect(margin + (index * stripeWidth), bottomStripeY, stripeWidth, bottomStripeHeight)
        })
      }

      // Wait for QR code to be drawn
      await drawQRCode()

      // Draw final border to ensure it's on top - like original
      frontCtx.strokeStyle = '#4CAF50'
      frontCtx.lineWidth = 3
      frontCtx.strokeRect(1.5, 1.5, cardWidth - 3, cardHeight - 3)

      // Create back side canvas
      const createBackSide = () => {
        const backCanvas = document.createElement('canvas')
        const backCtx = backCanvas.getContext('2d')!
        backCanvas.width = cardWidth
        backCanvas.height = cardHeight

        // Fill white background
        backCtx.fillStyle = '#FFFFFF'
        backCtx.fillRect(0, 0, cardWidth, cardHeight)

        // Draw green border around card
        backCtx.strokeStyle = '#4CAF50'
        backCtx.lineWidth = 4
        backCtx.strokeRect(8, 8, cardWidth - 16, cardHeight - 16)

        // Draw back side content
        const drawBackContent = () => {
          // Parent/Guardian section
          backCtx.fillStyle = '#000000'
          backCtx.font = 'bold 20px Arial'
          backCtx.textAlign = 'center'
          backCtx.fillText('Parent / Guardian', cardWidth/2, 50)

          // Phone number (using student phone as parent phone)
          backCtx.font = '16px Arial'
          const cleanPhone = student.phone ? student.phone.replace(/\s+/g, '') : '1234567890'
          backCtx.fillText(`Mob. :${cleanPhone}`, cardWidth/2, 80)

          // Student Address section
          backCtx.fillStyle = '#E3F2FD'
          backCtx.fillRect(30, 110, cardWidth - 60, 80)
          backCtx.strokeStyle = '#1976D2'
          backCtx.lineWidth = 2
          backCtx.strokeRect(30, 110, cardWidth - 60, 80)

          backCtx.fillStyle = '#1976D2'
          backCtx.font = 'bold 16px Arial'
          backCtx.textAlign = 'left'
          backCtx.fillText('Student address', 40, 135)

          // Student address content
          backCtx.fillStyle = '#000000'
          backCtx.font = '12px Arial'
          const studentAddress = student.address || 'B-1 Shahjanad Flats, Opp. Saraswati Complex, Manjalpur, Vadodara, Gujarat'

          // Function to wrap text properly
          const wrapText = (text: string, maxWidth: number) => {
            const words = text.split(' ')
            const lines = []
            let currentLine = ''

            for (const word of words) {
              const testLine = currentLine + (currentLine ? ' ' : '') + word
              const metrics = backCtx.measureText(testLine)
              if (metrics.width > maxWidth && currentLine) {
                lines.push(currentLine)
                currentLine = word
              } else {
                currentLine = testLine
              }
            }
            if (currentLine) lines.push(currentLine)
            return lines
          }

          const studentAddressLines = wrapText(studentAddress, cardWidth - 100)
          studentAddressLines.forEach((line, index) => {
            if (index < 3) { // Limit to 3 lines
              backCtx.fillText(line, 40, 155 + (index * 15))
            }
          })

          // College Address section
          backCtx.fillStyle = '#E3F2FD'
          backCtx.fillRect(30, 210, cardWidth - 60, 80)
          backCtx.strokeStyle = '#1976D2'
          backCtx.lineWidth = 2
          backCtx.strokeRect(30, 210, cardWidth - 60, 80)

          backCtx.fillStyle = '#1976D2'
          backCtx.font = 'bold 16px Arial'
          backCtx.fillText('College address', 40, 235)

          // College address content
          backCtx.fillStyle = '#000000'
          backCtx.font = '12px Arial'
          const collegeAddress = 'Vadodara-Mumbai National Highway 8, Vadodara, Gujarat 391240'
          const collegeAddressLines = wrapText(collegeAddress, cardWidth - 100)
          collegeAddressLines.forEach((line, index) => {
            if (index < 3) { // Limit to 3 lines
              backCtx.fillText(line, 40, 255 + (index * 15))
            }
          })

          // Instructions header
          backCtx.fillStyle = '#000000'
          backCtx.font = 'bold 18px Arial'
          backCtx.textAlign = 'center'
          backCtx.fillText('How to Use Your Digital ID Card', cardWidth/2, 320)

          // Manual Input Option section (green)
          backCtx.fillStyle = '#10B981'
          backCtx.fillRect(30, 340, cardWidth - 60, 120)
          backCtx.fillStyle = '#FFFFFF'
          backCtx.font = 'bold 14px Arial'
          backCtx.textAlign = 'left'
          backCtx.fillText('📝 Manual Input Option', 40, 365)

          backCtx.font = '11px Arial'
          const manualSteps = [
            '• Copy your Enrollment Number',
            '• Go to station\'s "Manual Entry" section',
            '• Paste your Enrollment Number',
            '• Click "Validate" to retrieve details',
            '• Continue with face verification'
          ]

          manualSteps.forEach((step, index) => {
            backCtx.fillText(step, 40, 385 + (index * 15))
          })

          // QR Code Scanning section (blue)
          backCtx.fillStyle = '#3B82F6'
          backCtx.fillRect(30, 470, cardWidth - 60, 140)
          backCtx.fillStyle = '#FFFFFF'
          backCtx.font = 'bold 14px Arial'
          backCtx.fillText('🔍 QR Code Scanning', 40, 495)

          backCtx.font = '11px Arial'
          const qrSteps = [
            '1. Show your QR code to station operator',
            '2. Operator will scan with the camera',
            '3. Hold QR code steady in front of camera',
            '4. System retrieves your details automatically',
            '5. Proceed to face verification'
          ]

          qrSteps.forEach((step, index) => {
            backCtx.fillText(step, 40, 515 + (index * 15))
          })
        }

        drawBackContent()

        // Combine front and back sides into a single image
        const finalCanvas = document.createElement('canvas')
        const finalCtx = finalCanvas.getContext('2d')!
        finalCanvas.width = cardWidth * 2 + 40
        finalCanvas.height = cardHeight

        // Add white background
        finalCtx.fillStyle = '#FFFFFF'
        finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height)

        // Add front side (left)
        finalCtx.drawImage(frontCanvas, 0, 0)

        // Add separator
        finalCtx.fillStyle = '#E0E0E0'
        finalCtx.fillRect(cardWidth + 10, 0, 20, cardHeight)
        finalCtx.fillStyle = '#666666'
        finalCtx.font = 'bold 16px Arial'
        finalCtx.textAlign = 'center'
        finalCtx.save()
        finalCtx.translate(cardWidth + 20, cardHeight / 2)
        finalCtx.rotate(-Math.PI / 2)
        finalCtx.fillText('FRONT SIDE', 0, 0)
        finalCtx.restore()

        // Add back side (right)
        finalCtx.drawImage(backCanvas, cardWidth + 40, 0)

        // Download the image
        const link = document.createElement('a')
        link.download = `${student.name.replace(/\s+/g, '_')}_KPGU_ID_Card.png`
        link.href = finalCanvas.toDataURL()
        link.click()
      }

      // Call createBackSide to generate the final card
      createBackSide()
    } catch (error) {
      console.error('Error generating ID card:', error)
      alert('Failed to generate ID card')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedText(`${type}-${text}`)
      setTimeout(() => setCopiedText(null), 2000)
    } catch (error) {
      alert("Failed to copy to clipboard")
    }
  }

  // Load calendar data for the current month
  const loadCalendarData = async (date: Date = new Date()) => {
    try {
      setLoadingCalendar(true)
      console.log("🗓️ Loading calendar data for:", date.toLocaleDateString())

      // Clear previous calendar data first
      setCalendarData({})

      // Get all entries and group by date
      const allEntries = await dbStore.getAllEntries()
      console.log("📊 Total entries loaded:", allEntries.length)

      const calendarEntries: {[key: string]: {entries: number, exits: number}} = {}

      // Group entries by date using local timezone
      allEntries.forEach(entry => {
        const entryDate = new Date(entry.entryTime)
        // Use local date string to avoid timezone issues
        const year = entryDate.getFullYear()
        const month = String(entryDate.getMonth() + 1).padStart(2, '0')
        const day = String(entryDate.getDate()).padStart(2, '0')
        const dateString = `${year}-${month}-${day}`

        if (!calendarEntries[dateString]) {
          calendarEntries[dateString] = { entries: 0, exits: 0 }
        }

        if (entry.status === 'entry') {
          calendarEntries[dateString].entries++
        } else if (entry.status === 'exit') {
          calendarEntries[dateString].exits++
        }
      })

      console.log("📅 Calendar data processed:", Object.keys(calendarEntries).length, "dates with activity")
      console.log("📅 Calendar entries:", calendarEntries)
      setCalendarData(calendarEntries)
    } catch (error) {
      console.error("❌ Error loading calendar data:", error)
      setCalendarData({}) // Clear data on error
    } finally {
      setLoadingCalendar(false)
    }
  }

  // Load entries for a specific selected date
  const loadSelectedDateEntries = async (date: Date) => {
    try {
      // Use local date string to avoid timezone issues
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const dateString = `${year}-${month}-${day}`

      const entries = await dbStore.getEntriesByDate(dateString)
      setSelectedDateEntries(entries)
    } catch (error) {
      console.error("Error loading selected date entries:", error)
      setSelectedDateEntries([])
    }
  }

  // Handle calendar date selection
  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date)
      loadSelectedDateEntries(date)
    }
  }

  // Open history calendar
  const openHistoryCalendar = () => {
    setShowHistoryCalendar(true)
    // Clear any existing calendar data first
    setCalendarData({})
    loadCalendarData()
    if (selectedDate) {
      loadSelectedDateEntries(selectedDate)
    }
  }

  const resetForm = () => {
    setNewStudent({
      name: "",
      phone: "",
      email: "",
      class: "",
      department: "",
      schedule: "",
      address: "",
      image: "",
    })
    setImagePreview(null)
    setImageFile(null)
    setShowAddForm(false)
    setEditingStudent(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const today = new Date().toISOString().slice(0, 10)

  const totalStudents = students.length

  // Replace the following with your actual attendance/logs array if available
  // For demonstration, using an empty array as placeholder
  const logs: { type: string; timestamp: string }[] = [] // Replace with actual logs source

  const todaysEntries = logs.filter(
    (e) => e.type === "entry" && e.timestamp.slice(0, 10) === today,
  ).length
  const todaysExits = logs.filter(
    (e) => e.type === "exit" && e.timestamp.slice(0, 10) === today,
  ).length
  const totalEntries = logs.filter((e) => e.type === "entry").length
  const remainingStudents = totalStudents - todaysExits

  if (!isAuthenticated) {
    return <div>Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-4">
      <div className="max-w-6xl mx-auto space-y-3 sm:space-y-6">
        {/* Header */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-xl sm:text-2xl lg:text-3xl">Admin Panel</CardTitle>
                <CardDescription className="text-sm sm:text-base lg:text-lg">
                  Student Management System - {storageInfo.mode} Storage
                </CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">

                <Button onClick={handleRefresh} variant="outline" disabled={loading} size="sm" className="w-full sm:w-auto">
                  <RefreshCw className={`mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 ${loading ? "animate-spin" : ""}`} />
                  <span className="text-xs sm:text-sm">Refresh</span>
                </Button>
                <Button onClick={handleLogout} variant="outline" size="sm" className="w-full sm:w-auto">
                  <LogOut className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="text-xs sm:text-sm">Logout</span>
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Storage Status Alert */}
        <Alert className={databaseConnected ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50"}>
          <Database className={`h-4 w-4 ${databaseConnected ? "text-green-600" : "text-yellow-600"}`} />
          <AlertDescription className={databaseConnected ? "text-green-800" : "text-yellow-800"}>
            <strong>{storageInfo.mode} Storage Active:</strong>{" "}
            {databaseConnected
              ? "Data syncs across all devices automatically"
              : `Data saved locally on this device (${storageInfo.studentsCount} students, ${storageInfo.entriesCount} entries)`}
          </AlertDescription>
        </Alert>

        {/* Stats - 4 Cards Layout with Auto-reload */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* Total Students Card */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4 sm:p-6 text-center">
              <div className="text-3xl sm:text-4xl font-bold text-blue-600 mb-2">
                {stats.totalStudents}
              </div>
              <div className="text-sm sm:text-base font-medium text-blue-700">
                Total Students
              </div>
              <div className="text-xs text-blue-500 mt-1">
                Registered
              </div>
            </CardContent>
          </Card>

          {/* Total Entries Card */}
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-4 sm:p-6 text-center">
              <div className="text-3xl sm:text-4xl font-bold text-green-600 mb-2">
                {stats.todayEntries}
              </div>
              <div className="text-sm sm:text-base font-medium text-green-700">
                Today's Entries
              </div>
              <div className="text-xs text-green-500 mt-1">
                Students who entered
              </div>
            </CardContent>
          </Card>

          {/* Total Exits Card */}
          <Card className="bg-red-50 border-red-200">
            <CardContent className="p-4 sm:p-6 text-center">
              <div className="text-3xl sm:text-4xl font-bold text-red-600 mb-2">
                {stats.todayExits}
              </div>
              <div className="text-sm sm:text-base font-medium text-red-700">
                Today's Exits
              </div>
              <div className="text-xs text-red-500 mt-1">
                Students who exited
              </div>
            </CardContent>
          </Card>

          {/* History Calendar Card */}
          <Card className="bg-orange-50 border-orange-200 cursor-pointer hover:bg-orange-100 transition-colors" onClick={openHistoryCalendar}>
            <CardContent className="p-4 sm:p-6 text-center">
              <div className="text-3xl sm:text-4xl font-bold text-orange-600 mb-2">
                <CalendarIcon className="h-8 w-8 sm:h-10 sm:w-10 mx-auto" />
              </div>
              <div className="text-sm sm:text-base font-medium text-orange-700">
                History Calendar
              </div>
              <div className="text-xs text-orange-500 mt-1">
                Click to View
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Auto-reload Indicator with Manual Refresh */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>Auto-refreshing every 5 seconds</span>
            <span className={`text-xs px-2 py-1 rounded ${
              dataSource === 'mongodb'
                ? 'bg-green-100 text-green-700'
                : 'bg-yellow-100 text-yellow-700'
            }`}>
              {dataSource === 'mongodb' ? '�️ Shared MongoDB' : '💾 Local Fallback'}
            </span>
            {lastUpdated && (
              <span className="text-xs text-gray-400">
                • {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>

        </div>

        {/* Add Student Button */}
        {!showAddForm && !editingStudent && (
          <Card>
            <CardContent className="p-6">
              <Button onClick={() => setShowAddForm(true)} className="w-full h-16 text-lg" disabled={loading}>
                <UserPlus className="mr-2 h-6 w-6" />
                Add New Student
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Add/Edit Student Form */}
        {(showAddForm || editingStudent) && (
          <Card>
            <CardHeader>
              <CardTitle>{editingStudent ? "Edit Student" : "Add New Student"}</CardTitle>
              <CardDescription>
                {editingStudent ? "Update student information" : "Fill required fields to register a new student"} -
                Data will be saved in {storageInfo.mode} storage
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Student Photo Upload Section */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">Student Photo *</Label>

                {/* Image Preview */}
                {imagePreview ? (
                  <div className="flex items-center space-x-4">
                    <div className="relative">
                      <img
                        src={imagePreview || "/placeholder.svg"}
                        alt="Student preview"
                        className="w-32 h-32 rounded-full border-4 border-blue-200 object-cover"
                      />
                      <Button
                        onClick={removeImage}
                        size="sm"
                        variant="destructive"
                        className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-green-600">✅ Photo uploaded successfully</p>
                      <Button onClick={() => fileInputRef.current?.click()} variant="outline" size="sm">
                        <Upload className="mr-2 h-4 w-4" />
                        Change Photo
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                    <ImageIcon className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600 mb-4">Upload student photo (Required)</p>
                    <div className="flex justify-center space-x-4">
                      <Button onClick={() => fileInputRef.current?.click()} variant="outline">
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Photo
                      </Button>
                      <Button onClick={takePhoto} variant="outline">
                        <Camera className="mr-2 h-4 w-4" />
                        Take Photo
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Supported formats: JPG, PNG, GIF (Max 5MB)</p>
                  </div>
                )}

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </div>

              <Separator />

              {/* Student Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Student Name *</Label>
                  <Input
                    id="name"
                    value={newStudent.name}
                    onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                    placeholder="Enter full name"
                    disabled={loading}
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    value={newStudent.phone}
                    onChange={(e) => setNewStudent({ ...newStudent, phone: e.target.value })}
                    placeholder="10-digit phone number"
                    maxLength={10}
                    disabled={loading}
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newStudent.email}
                    onChange={(e) => setNewStudent({ ...newStudent, email: e.target.value })}
                    placeholder="student@example.com"
                    disabled={loading}
                  />
                </div>
                <div>
                  <Label htmlFor="class">Semester *</Label>
                  <Input
                    id="class"
                    value={newStudent.class}
                    onChange={(e) => setNewStudent({ ...newStudent, class: e.target.value })}
                    placeholder="Enter semester (e.g., Semester 1, Sem 3, etc.)"
                    disabled={loading}
                  />
                </div>
                <div>
                  <Label htmlFor="department">Department *</Label>
                  <Select
                    value={newStudent.department || "Diploma (CSE)"}
                    onValueChange={(value) => setNewStudent({ ...newStudent, department: value })}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Diploma (AIML)">Diploma (AIML)</SelectItem>
                      <SelectItem value="Diploma (CSE)">Diploma (CSE)</SelectItem>
                      <SelectItem value="Diploma (Electrical)">Diploma (Electrical)</SelectItem>
                      <SelectItem value="Diploma (IT)">Diploma (IT)</SelectItem>
                      <SelectItem value="Diploma (Mechanical)">Diploma (Mechanical)</SelectItem>
                      <SelectItem value="B-Tech (Civil)">B-Tech (Civil)</SelectItem>
                      <SelectItem value="B-Tech (CSE)">B-Tech (CSE)</SelectItem>
                      <SelectItem value="B-Tech (Electrical)">B-Tech (Electrical)</SelectItem>
                      <SelectItem value="B-Tech (IT)">B-Tech (IT)</SelectItem>
                      <SelectItem value="B-Tech (Mechanical)">B-Tech (Mechanical)</SelectItem>
                      <SelectItem value="B.Pharm">B.Pharm</SelectItem>
                      <SelectItem value="BPT">BPT</SelectItem>
                      <SelectItem value="Bsc">Bsc</SelectItem>
                      <SelectItem value="Bsc Nursing">Bsc Nursing</SelectItem>
                      <SelectItem value="M.Pharm">M.Pharm</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="schedule">Time Schedule</Label>
                  <Select
                    value={newStudent.schedule}
                    onValueChange={(value) => setNewStudent({ ...newStudent, schedule: value })}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select schedule" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Morning Shift (8:00 AM - 2:00 PM)">
                        Morning Shift (8:00 AM - 2:00 PM)
                      </SelectItem>
                      <SelectItem value="Afternoon Shift (2:00 PM - 8:00 PM)">
                        Afternoon Shift (2:00 PM - 8:00 PM)
                      </SelectItem>
                      <SelectItem value="Full Day (8:00 AM - 4:00 PM)">Full Day (8:00 AM - 4:00 PM)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  placeholder="Enter student address"
                  value={newStudent.address}
                  onChange={(e) => setNewStudent({ ...newStudent, address: e.target.value })}
                  disabled={loading}
                  rows={3}
                />
              </div>

              <Separator />

              <div className="flex gap-2">
                {editingStudent ? (
                  <Button onClick={handleUpdateStudent} className="flex-1" disabled={loading}>
                    <Save className="mr-2 h-4 w-4" />
                    {loading ? "Updating..." : "Update Student"}
                  </Button>
                ) : (
                  <Button onClick={handleAddStudent} className="flex-1" disabled={loading}>
                    <UserPlus className="mr-2 h-4 w-4" />
                    {loading ? "Adding..." : "Add Student"}
                  </Button>
                )}
                <Button onClick={resetForm} variant="outline" className="flex-1 bg-transparent" disabled={loading}>
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Students List */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg sm:text-xl">
                  Registered Students ({filteredStudents.length}{searchQuery && ` of ${students.length}`})
                </CardTitle>
                <CardDescription className="text-sm">
                  All registered students with their login credentials - Stored in {storageInfo.mode} storage
                </CardDescription>
              </div>
              <div className="w-full sm:w-72">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <Input
                    type="text"
                    placeholder="Search students..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 text-sm"
                  />
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSearchQuery("")}
                      className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {students.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                <p className="text-xl text-gray-500 mb-2">No students registered yet</p>
                <p className="text-gray-400">Click "Add New Student" to get started</p>
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="text-center py-12">
                <Search className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                <p className="text-xl text-gray-500 mb-2">No students found</p>
                <p className="text-gray-400">Try adjusting your search terms</p>
                <Button
                  variant="outline"
                  onClick={() => setSearchQuery("")}
                  className="mt-4"
                >
                  Clear Search
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredStudents.map((student) => (
                  <div key={student.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 bg-gray-50 rounded-lg border gap-3 sm:gap-0">
                    <div className="flex items-center space-x-3 sm:space-x-4">
                      <img
                        src={student.image_url || "/placeholder.svg?height=60&width=60"}
                        alt={student.name}
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-gray-200 object-cover flex-shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-base sm:text-lg truncate">{student.name}</h3>
                        <p className="text-xs sm:text-sm text-gray-600 truncate">
                          {student.class} {student.department && `- ${student.department}`}
                        </p>
                        <p className="text-xs sm:text-sm text-gray-500">{student.phone}</p>
                        {student.email && <p className="text-xs text-gray-400 truncate">{student.email}</p>}
                        {student.address && <p className="text-xs text-gray-400 truncate">📍 {student.address}</p>}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                      {/* Login Credentials */}
                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-xs">
                            Enr: {student.application_number}
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(student.application_number, "app")}
                            className="h-6 w-6 p-0"
                          >
                            {copiedText === `app-${student.application_number}` ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            Phone: {student.phone}
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(student.phone, "phone")}
                            className="h-6 w-6 p-0"
                          >
                            {copiedText === `phone-${student.phone}` ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2 justify-end sm:justify-start">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => showStudentDetailsModal(student)}
                          disabled={loading}
                          className="h-8 w-8 p-0 bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700"
                          title="View Details & Attendance"
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditStudent(student)}
                          disabled={loading}
                          className="h-8 w-8 p-0"
                          title="Edit Student"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadIDCard(student)}
                          disabled={loading}
                          className="h-8 w-8 p-0 bg-green-50 hover:bg-green-100 border-green-200 text-green-700"
                          title="Download ID Card"
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteStudent(student)}
                          disabled={loading}
                          className="h-8 w-8 p-0"
                          title="Delete Student"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Admin Instructions - {storageInfo.mode} Storage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-blue-700 mb-2">Required Fields:</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>✅ Student Name (Full name required)</li>
                  <li>✅ Phone Number (10 digits, unique)</li>
                  <li>✅ Semester (Manual input field)</li>
                  <li>✅ Student Photo (Upload or camera)</li>
                  <li>✅ Department (Required - defaults to Diploma CSE)</li>
                  <li>📝 Email (Optional)</li>
                  <li>📝 Schedule (Optional)</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-green-700 mb-2">Photo Requirements:</h3>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>📸 Clear face photo required</li>
                  <li>📸 JPG, PNG, GIF formats supported</li>
                  <li>📸 Maximum file size: 5MB</li>
                  <li>📸 Upload from device or take with camera</li>
                  <li>📸 Used for face verification at station</li>
                  <li>📸 Can be changed during editing</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* History Calendar Dialog */}
        <Dialog open={showHistoryCalendar} onOpenChange={setShowHistoryCalendar}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Entry/Exit History Calendar
              </DialogTitle>
              <DialogDescription>
                Click on any date to view entry and exit counts for that day
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Calendar Section */}
              <div className="space-y-4">
                <div className="text-center">
                  <h3 className="text-lg font-semibold mb-2">Select Date</h3>
                  {loadingCalendar && (
                    <p className="text-sm text-gray-500 mb-2">Loading calendar data...</p>
                  )}
                </div>

                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  className="rounded-md border green-dates-calendar"
                  modifiers={{
                    hasData: (date) => {
                      // Use local date string to avoid timezone issues
                      const year = date.getFullYear()
                      const month = String(date.getMonth() + 1).padStart(2, '0')
                      const day = String(date.getDate()).padStart(2, '0')
                      const dateString = `${year}-${month}-${day}`
                      const hasActivity = !!calendarData[dateString]
                      console.log(`Date ${dateString}: hasActivity = ${hasActivity}`, calendarData[dateString])
                      return hasActivity
                    }
                  }}
                  modifiersStyles={{
                    hasData: {
                      backgroundColor: '#22c55e',
                      color: '#ffffff',
                      fontWeight: 'bold',
                      borderRadius: '6px'
                    }
                  }}
                />

                <style jsx global>{`
                  .green-dates-calendar .rdp-day_button.rdp-day_selected {
                    background-color: #1e40af !important;
                    color: white !important;
                    font-weight: bold !important;
                    border-radius: 6px !important;
                  }
                  .green-dates-calendar .rdp-day_button:hover:not(.rdp-day_disabled):not(.rdp-day_outside) {
                    background-color: #f3f4f6 !important;
                    transform: scale(1.05);
                    transition: all 0.2s ease;
                  }
                  .green-dates-calendar .rdp-day_button.rdp-day_disabled {
                    background-color: transparent !important;
                    color: #9ca3af !important;
                    font-weight: normal !important;
                  }
                  .green-dates-calendar .rdp-day_button.rdp-day_outside {
                    background-color: transparent !important;
                    color: #d1d5db !important;
                    font-weight: normal !important;
                  }
                `}</style>

                <div className="text-xs text-gray-500 space-y-2">
                  <p>• Click any date to view detailed entry/exit counts</p>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={async () => {
                        console.log("🔄 Manual calendar refresh triggered")
                        setCalendarData({})
                        setSelectedDateEntries([])
                        await loadCalendarData()
                        console.log("✅ Calendar manually refreshed")
                      }}
                      className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded hover:bg-blue-200 transition-colors"
                      disabled={loadingCalendar}
                    >
                      {loadingCalendar ? "Refreshing..." : "🔄 Refresh Calendar"}
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          console.log("🧪 Testing database connection...")
                          const res = await fetch('/api/test-db')
                          const result = await res.json()
                          console.log("🧪 Database test result:", result)
                          if (result.success) {
                            alert(`✅ Database Connected!\n\nStudents: ${result.stats.students}\nEntries: ${result.stats.entries}\n\nConnection working properly.`)
                          } else {
                            alert(`❌ Database Error!\n\n${result.error}\n\nDetails: ${result.details || 'No details'}`)
                          }
                        } catch (error) {
                          console.error("Database test failed:", error)
                          alert(`❌ Database Test Failed!\n\n${error instanceof Error ? error.message : 'Unknown error'}`)
                        }
                      }}
                      className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded hover:bg-green-200 transition-colors"
                    >
                      🧪 Test Database
                    </button>
                  </div>
                </div>
              </div>

              {/* Selected Date Details */}
              <div className="space-y-4">
                <div className="text-center">
                  <h3 className="text-lg font-semibold mb-2">
                    {selectedDate ? selectedDate.toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    }) : 'Select a date'}
                  </h3>
                </div>

                {selectedDate && (
                  <div className="space-y-4">
                    {/* Stats for selected date */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {selectedDateEntries.length}
                        </div>
                        <div className="text-sm font-medium text-green-700">Entries</div>
                      </div>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                        <div className="text-2xl font-bold text-red-600">
                          {selectedDateEntries.filter(e => e.exitTime || e.exit_time).length}
                        </div>
                        <div className="text-sm font-medium text-red-700">Exits</div>
                      </div>
                    </div>

                    {/* Search Box */}
                    <div className="border rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Search className="h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="Search student by name..."
                          value={calendarSearchQuery}
                          onChange={(e) => setCalendarSearchQuery(e.target.value)}
                          className="flex-1"
                        />
                      </div>
                    </div>

                    {/* Entry list for selected date */}
                    <div className="border rounded-lg p-4 max-h-64 overflow-y-auto">
                      <h4 className="font-semibold mb-3">Activity Details</h4>
                      {(() => {
                        const filteredEntries = selectedDateEntries.filter(entry =>
                          entry.student_name.toLowerCase().includes(calendarSearchQuery.toLowerCase())
                        )

                        if (filteredEntries.length === 0) {
                          return calendarSearchQuery ? (
                            <p className="text-gray-500 text-center py-4">No students found matching "{calendarSearchQuery}"</p>
                          ) : (
                            <p className="text-gray-500 text-center py-4">No activity recorded for this date</p>
                          )
                        }

                        return (
                          <div className="space-y-2">
                            {filteredEntries.map((entry, index) => (
                            <div key={entry.id || index} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                              <div className="flex items-center gap-3">
                                <span className={`w-2 h-2 rounded-full ${entry.exitTime || entry.exit_time ? 'bg-red-500' : 'bg-green-500'}`}></span>
                                <span className="font-medium">{entry.student_name}</span>
                                <span className="text-green-600 font-medium ml-2">
                                  {new Date(entry.entryTime || entry.entry_time).toLocaleTimeString('en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                                {(entry.exitTime || entry.exit_time) && (
                                  <span className="text-red-600 font-medium ml-4">
                                    {new Date(entry.exitTime || entry.exit_time).toLocaleTimeString('en-US', {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </span>
                                )}
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={async () => {
                                  // Find student details
                                  const student = students.find(s => s.name === entry.student_name)
                                  if (student) {
                                    const studentInfo = `👤 STUDENT DETAILS\n\n` +
                                      `Name: ${student.name}\n` +
                                      `Enrollment Number: ${student.application_number}\n` +
                                      `Phone: ${student.phone}\n` +
                                      `Email: ${student.email || 'Not provided'}\n` +
                                      `Class: ${student.class || 'Not provided'}\n` +
                                      `Department: ${student.department || 'Not provided'}\n\n` +
                                      `📅 ACTIVITY ON ${selectedDate?.toLocaleDateString()}\n\n` +
                                      `🟢 Entry Time: ${new Date(entry.entryTime || entry.entry_time).toLocaleString()}\n` +
                                      `${(entry.exitTime || entry.exit_time) ?
                                        `🔴 Exit Time: ${new Date(entry.exitTime || entry.exit_time).toLocaleString()}` :
                                        '⏳ Still Inside (No Exit Record)'}`

                                    alert(studentInfo)
                                  } else {
                                    alert(`❌ Student details not found for: ${entry.student_name}`)
                                  }
                                }}
                                className="h-6 w-6 p-0"
                              >
                                <Eye className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                        )
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Student Details Modal */}
        <Dialog open={showStudentDetails} onOpenChange={setShowStudentDetails}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <img
                  src={selectedStudent?.image_url || "/placeholder.svg?height=40&width=40"}
                  alt={selectedStudent?.name}
                  className="w-10 h-10 rounded-full border-2 border-gray-200 object-cover"
                />
                <div>
                  <div className="text-lg font-semibold">{selectedStudent?.name}</div>
                  <div className="text-sm text-gray-500">{selectedStudent?.application_number}</div>
                </div>
              </DialogTitle>
              <DialogDescription>
                Student attendance history and details
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Student Info Summary */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <h4 className="font-semibold text-sm text-gray-700">Personal Information</h4>
                  <div className="mt-2 space-y-1 text-sm">
                    <p><span className="font-medium">Class:</span> {selectedStudent?.class}</p>
                    <p><span className="font-medium">Department:</span> {selectedStudent?.department}</p>
                    <p><span className="font-medium">Phone:</span> {selectedStudent?.phone}</p>
                    {selectedStudent?.email && <p><span className="font-medium">Email:</span> {selectedStudent?.email}</p>}
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-sm text-gray-700">Attendance Summary</h4>
                  <div className="mt-2 space-y-1 text-sm">
                    <p><span className="font-medium">Total Visits:</span> {studentEntries.length}</p>
                    <p><span className="font-medium">This Month:</span> {studentEntries.filter(entry => {
                      const entryDate = new Date(entry.entry_time || entry.entryTime)
                      const now = new Date()
                      return entryDate.getMonth() === now.getMonth() && entryDate.getFullYear() === now.getFullYear()
                    }).length}</p>
                    <p><span className="font-medium">Last Visit:</span> {
                      studentEntries.length > 0
                        ? new Date(studentEntries[0].entry_time || studentEntries[0].entryTime).toLocaleDateString()
                        : 'Never'
                    }</p>
                  </div>
                </div>
              </div>

              {/* Attendance History */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-lg">Entry/Exit History</h4>
                  {studentEntries.length > 0 && (
                    <div className="text-sm text-gray-500">
                      Total Entries: {studentEntries.length} | Page: {currentPage}
                    </div>
                  )}
                </div>

                {loadingEntries ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                    <span className="ml-2 text-gray-500">Loading attendance history...</span>
                  </div>
                ) : studentEntries.length > 0 ? (
                  <>
                    {/* Entries List */}
                    <div className="space-y-3">
                      {(() => {
                        const startIndex = (currentPage - 1) * entriesPerPage
                        const endIndex = startIndex + entriesPerPage
                        const currentEntries = studentEntries.slice(startIndex, endIndex)

                        return currentEntries.map((entry, index) => {
                          const entryTime = new Date(entry.entry_time || entry.entryTime)
                          const exitTime = entry.exit_time ? new Date(entry.exit_time) : null
                          const duration = exitTime ? Math.round((exitTime.getTime() - entryTime.getTime()) / (1000 * 60)) : null

                          return (
                            <div key={entry.id || index} className="border-l-4 border-blue-500 bg-white p-4 rounded-lg shadow-sm">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="flex flex-col items-center">
                                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                    {exitTime && (
                                      <>
                                        <div className="w-0.5 h-4 bg-gray-300 my-1"></div>
                                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                      </>
                                    )}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-sm">Entry:</span>
                                      <span className="text-sm">{entryTime.toLocaleDateString()} • {entryTime.toLocaleTimeString()}</span>
                                      {entry.verified && <span className="text-xs text-green-600">✓</span>}
                                    </div>
                                    {exitTime && (
                                      <div className="flex items-center gap-2 mt-1">
                                        <span className="font-medium text-sm">Exit:</span>
                                        <span className="text-sm">{exitTime.toLocaleDateString()} • {exitTime.toLocaleTimeString()}</span>
                                      </div>
                                    )}
                                    {duration && (
                                      <div className="text-xs text-blue-600 mt-1">
                                        Duration: {duration < 60 ? `${duration}m` : `${Math.floor(duration/60)}h ${duration%60}m`}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <Badge variant={exitTime ? 'secondary' : 'default'} className="text-xs">
                                    {exitTime ? 'Out' : 'In'}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          )
                        })
                      })()}
                    </div>

                    {/* Pagination */}
                    {studentEntries.length > entriesPerPage && (
                      <div className="flex items-center justify-between mt-6 pt-4 border-t">
                        <div className="text-sm text-gray-500">
                          Showing {((currentPage - 1) * entriesPerPage) + 1} to {Math.min(currentPage * entriesPerPage, studentEntries.length)} of {studentEntries.length} entries
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="text-xs"
                          >
                            Previous
                          </Button>

                          {(() => {
                            const totalPages = Math.ceil(studentEntries.length / entriesPerPage)
                            const pages = []

                            // Show first page
                            if (totalPages > 0) pages.push(1)

                            // Show current page and surrounding pages
                            for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
                              if (!pages.includes(i)) pages.push(i)
                            }

                            // Show last page
                            if (totalPages > 1 && !pages.includes(totalPages)) {
                              if (pages[pages.length - 1] < totalPages - 1) pages.push('...')
                              pages.push(totalPages)
                            }

                            return pages.map((page, index) => (
                              page === '...' ? (
                                <span key={index} className="px-2 text-gray-400">...</span>
                              ) : (
                                <Button
                                  key={page}
                                  size="sm"
                                  variant={currentPage === page ? "default" : "outline"}
                                  onClick={() => setCurrentPage(page as number)}
                                  className="w-8 h-8 p-0 text-xs"
                                >
                                  {page}
                                </Button>
                              )
                            ))
                          })()}

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(studentEntries.length / entriesPerPage)))}
                            disabled={currentPage === Math.ceil(studentEntries.length / entriesPerPage)}
                            className="text-xs"
                          >
                            Next
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Activity className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>No attendance records found</p>
                    <p className="text-sm">This student hasn't visited yet</p>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

function StatCard({ icon, value, label, color }: any) {
  return (
    <div className="bg-white rounded-lg shadow p-6 flex items-center">
      <span className={`text-${color}-500 text-3xl mr-4`}>{icon}</span>
      <div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-gray-600">{label}</div>
      </div>
    </div>
  );
}

const UserIcon = () => <Users className="h-6 w-6 text-blue-600" />
const EntryIcon = () => <Activity className="h-6 w-6 text-green-600" />
const ExitIcon = () => <X className="h-6 w-6 text-red-600" />
const TotalIcon = () => <Database className="h-6 w-6 text-purple-600" />
const RemainIcon = () => <Badge className="h-6 w-6 text-orange-600" />

