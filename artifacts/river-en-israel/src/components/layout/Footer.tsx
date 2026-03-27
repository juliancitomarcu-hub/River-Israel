import { MapPin, Mail, Phone, Facebook, Instagram, Youtube, Twitter } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-river-black text-white border-t-4 border-river-red pt-16 pb-8" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">

          {/* מיתוג */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 overflow-hidden rounded-full border-2 border-white">
                <div className="absolute inset-0 bg-diagonal-red"></div>
              </div>
              <span className="font-display font-bold text-3xl">ריבר בישראל</span>
            </div>
            <p className="text-gray-400 max-w-sm mt-4">
              הסניף הרשמי של קלוב אטלטיקו ריבר פלייט במזרח התיכון.
              חיים את התשוקה לבנדה דל מיליונריו מהארץ הקדושה. 🇦🇷 ❤️ 🇮🇱
            </p>
          </div>

          {/* יצירת קשר */}
          <div>
            <h4 className="font-display text-xl mb-6 text-river-red">יצירת קשר - הסניף</h4>
            <ul className="space-y-4 text-gray-300">
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-river-red shrink-0 mt-0.5" />
                <span>רמת גן, מחוז תל אביב, ישראל</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-river-red shrink-0" />
                <a href="mailto:info@riverenisrael.com" className="hover:text-white transition-colors">info@riverenisrael.com</a>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-river-red shrink-0" />
                <a href="tel:+972501234567" className="hover:text-white transition-colors">+972 50-123-4567</a>
              </li>
            </ul>
          </div>

          {/* רשתות חברתיות */}
          <div>
            <h4 className="font-display text-xl mb-6 text-river-red">עקבו אחרינו</h4>
            <div className="flex gap-4">
              <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-river-red transition-all hover:-translate-y-1">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-river-red transition-all hover:-translate-y-1">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-river-red transition-all hover:-translate-y-1">
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-river-red transition-all hover:-translate-y-1">
                <Youtube className="w-5 h-5" />
              </a>
            </div>
            <div className="mt-8">
              <p className="text-sm text-gray-500">האתר הרשמי של קלוב אטלטיקו ריבר פלייט</p>
              <a href="https://www.cariverplate.com.ar" target="_blank" rel="noreferrer" className="text-sm font-bold hover:text-river-red transition-colors">
                www.cariverplate.com.ar
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between text-sm text-gray-500">
          <p>© {new Date().getFullYear()} ריבר בישראל - סניף רמת גן. כל הזכויות שמורות.</p>
          <div className="flex gap-4 mt-4 md:mt-0">
            <a href="#" className="hover:text-white transition-colors">פרטיות</a>
            <a href="#" className="hover:text-white transition-colors">תנאים</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
