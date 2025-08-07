import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Arkus Dynamic Pricing
        </h1>
        <p className="text-gray-600 mb-8">
          Welcome to our dynamic pricing platform
        </p>
        <Link 
          href="/login" 
          className="bg-red-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-red-700 transition-colors"
        >
          Go to Login
        </Link>
      </div>
    </div>
  )
}
