import { Heart } from "lucide-react";

const Footer = () => {
  const footerLinks = {
    Platform: ["Find Equipment", "List Your Device", "How it Works", "Pricing"],
    Safety: ["Verification Process", "Insurance", "Guidelines", "Trust & Safety"],
    Company: ["About Us", "Careers", "Blog", "Press"],
    Support: ["Help Center", "Contact Us", "FAQs", "Report Issue"],
  };

  return (
    <footer className="bg-foreground text-primary-foreground py-16 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Top Section */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Logo & Description */}
          <div className="col-span-2 md:col-span-1">
            <a href="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-sm">P</span>
              </div>
              <span className="text-xl font-bold">
                Pharma<span className="text-primary">-Grid</span>
              </span>
            </a>
            <p className="text-primary-foreground/70 text-sm leading-relaxed">
              Connecting communities through vital medical equipment. Making healthcare accessible, one neighborhood at a time.
            </p>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="font-semibold mb-4 text-primary-foreground/90">{category}</h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-primary-foreground/60 hover:text-primary transition-colors text-sm"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="border-t border-primary-foreground/10 pt-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-primary-foreground/50 text-sm flex items-center gap-1">
              Made with <Heart className="w-4 h-4 text-coral fill-coral" /> for healthier communities
            </p>
            <div className="flex items-center gap-6">
              <a href="#" className="text-primary-foreground/50 hover:text-primary-foreground text-sm transition-colors">
                Privacy Policy
              </a>
              <a href="#" className="text-primary-foreground/50 hover:text-primary-foreground text-sm transition-colors">
                Terms of Service
              </a>
              <a href="#" className="text-primary-foreground/50 hover:text-primary-foreground text-sm transition-colors">
                Cookies
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
