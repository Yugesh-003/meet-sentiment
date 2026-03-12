import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

export default function ExportButton({ targetId = 'report-root', filename = 'meetmind-report' }) {
  async function handleExport() {
    const el = document.getElementById(targetId)
    if (!el) return
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#030712' })
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [canvas.width / 2, canvas.height / 2] })
    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2)
    pdf.save(`${filename}.pdf`)
  }

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-colors"
    >
      ↓ Export PDF
    </button>
  )
}
