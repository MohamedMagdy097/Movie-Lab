import { LipSyncTest } from "@/components/lip-sync-test"

export default function LipSyncTestPage() {
  return (
    <div className="min-h-screen bg-[#0a0b0d] text-gray-100 p-8">
      {/* Cool background */}
      <div className="absolute inset-0 bg-[url('/')] bg-cover bg-center opacity-20"></div>
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a1b1e] via-[#0d0e10] to-[#0a0b0d] opacity-90"></div>
      
      <div className="relative z-10">
        <h1 className="text-4xl font-bold text-center mb-8 text-transparent bg-clip-text bg-gradient-to-r from-gray-200 to-gray-400">
          Lip Sync Testing Tool
        </h1>
        <LipSyncTest />
      </div>
    </div>
  )
}
