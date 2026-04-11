import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUp } from "lucide-react";

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
};

const fadeIn = {
  initial: { opacity: 0 },
  whileInView: { opacity: 1 },
  viewport: { once: true, margin: "-100px" },
  transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] },
};

const Footer = () => {
  const [openSections, setOpenSections] = useState([]);
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 300);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const footerItems = [
    {
      title: "Platform",
      items: [
        { name: "Features", link: "/features" },
        { name: "AI Analysis", link: "/pricing" },
        { name: "Health Coaching", link: "/about" },
        { name: "Pricing", link: "/contact" },
      ],
    },
    {
      title: "Support",
      items: [
        { name: "Help Center", link: "/features" },
        { name: "Safety Guide", link: "/pricing" },
        { name: "Community", link: "/about" },
        { name: "Contact", link: "/contact" },
      ],
    },
    {
      title: "Legal",
      items: [
        { name: "Privacy Policy", link: "/features" },
        { name: "Terms of Service", link: "/pricing" },
        { name: "Medical Disclaimer", link: "/about" },
      ],
    },
  ];

  const toggleSection = (title) => {
    setOpenSections((current) =>
      current.includes(title)
        ? current.filter((section) => section !== title)
        : [...current, title],
    );
  };

  return (
    <motion.section
      {...fadeIn}
      className="bg-landing-text text-white/60 rounded-tl-[30px] rounded-tr-[30px] lg:rounded-tl-[100px] lg:rounded-tr-[100px]"
    >
      <div className="container mx-auto py-10 px-5 lg:px-20 flex flex-col justify-between items-center gap-10 ">
        <motion.div
          {...fadeUp}
          className="hidden lg:flex flex-col md:flex-row gap-16 items-start py-8 justify-between w-full"
        >
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{
              duration: 0.55,
              delay: 0.04,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <img src="/landing/logo.svg" className="mb-5" alt="" />
            <p className="max-w-sm">
              The definitive AI health companion for those who demand more from
              their bodies. Precision analytics for everyday vitality.
            </p>
          </motion.div>

          {footerItems.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{
                duration: 0.55,
                delay: 0.08 + index * 0.05,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <h5 className="uppercase text-white/50 mb-5 tracking-wider">
                {item.title}
              </h5>
              <ul className="flex flex-col gap-2">
                {item.items.map((menuItem, itemIndex) => (
                  <li
                    key={itemIndex}
                    className="text-white/80 hover:text-white transition"
                  >
                    <Link to={menuItem.link}>{menuItem.name}</Link>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{
              duration: 0.55,
              delay: 0.24,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <h5 className="uppercase text-white/50 mb-5 tracking-wider">
              Stay Updated
            </h5>
            <p>Join our newsletter for the latest in longevity research.</p>

            <form className="relative py-2 border-b border-gray-500 mt-5">
              <input
                type="text"
                placeholder="Enter your email address"
                className="w-full bg-transparent outline-none border-none ring-0 focus:outline-none focus:ring-0 focus:bg-transparent focus:border-none"
              />
              <button
                type="submit"
                className="text-white absolute right-0 bottom-2"
              >
                Subscribe
              </button>
            </form>
          </motion.div>
        </motion.div>

        <motion.div
          {...fadeUp}
          className="flex lg:hidden flex-col gap-6 py-8 w-full"
        >
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{
              duration: 0.55,
              delay: 0.04,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <img src="/landing/logo.svg" className="mb-5" alt="" />
            <p className="max-w-sm">
              The definitive AI health companion for those who demand more from
              their bodies. Precision analytics for everyday vitality.
            </p>
          </motion.div>

          <div className="flex flex-col gap-4 w-full">
            {footerItems.map((item, index) => {
              const isOpen = openSections.includes(item.title);

              return (
                <div key={index} className="border-b border-white/10 pb-4">
                  <button
                    type="button"
                    onClick={() => toggleSection(item.title)}
                    className="flex w-full items-center justify-between py-2 text-left uppercase tracking-wider text-white/50"
                    aria-expanded={isOpen}
                  >
                    <span>{item.title}</span>
                    <span
                      className={`text-white/40 transition-transform duration-300 ${
                        isOpen ? "rotate-180" : "rotate-0"
                      }`}
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          d="M6 9L12 15L18 9"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </button>
                  <div
                    className={`grid overflow-hidden transition-all duration-300 ease-out ${
                      isOpen
                        ? "grid-rows-[1fr] opacity-100 mt-3"
                        : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <ul className="flex flex-col gap-2">
                        {item.items.map((menuItem, itemIndex) => (
                          <li
                            key={itemIndex}
                            className="text-white/80 hover:text-white transition"
                          >
                            <Link to={menuItem.link}>{menuItem.name}</Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{
              duration: 0.55,
              delay: 0.24,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <h5 className="uppercase text-white/50 mb-5 tracking-wider">
              Stay Updated
            </h5>
            <p>Join our newsletter for the latest in longevity research.</p>

            <form className="relative py-2 border-b border-gray-500 mt-5">
              <input
                type="text"
                placeholder="Enter your email address"
                className="w-full bg-transparent outline-none border-none ring-0 focus:outline-none focus:ring-0 focus:bg-transparent focus:border-none"
              />
              <button
                type="submit"
                className="text-white absolute right-0 bottom-2"
              >
                Subscribe
              </button>
            </form>
          </motion.div>
        </motion.div>

        <div className="text-center lg:text-left lg:flex justify-between w-full border-t border-white/10 pt-5">
          <p>© 2026 FitCure Inc. All rights reserved.</p>
          <p>Designed with purpose. Priced with care.</p>
        </div>

        <motion.button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          initial={{ opacity: 0, y: 12, scale: 0.95 }}
          animate={
            showBackToTop
              ? { opacity: 1, y: 0, scale: 1 }
              : { opacity: 0, y: 12, scale: 0.95 }
          }
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/10 text-landing-text shadow-[0_12px_30px_rgba(0,0,0,0.25)] backdrop-blur-xl transition-transform duration-200 hover:scale-105 hover:bg-white/15 focus:outline-none focus:ring-offset-2 md:bottom-8 md:right-8"
          aria-label="Back to top"
          title="Back to top"
        >
          <ArrowUp className="h-5 w-5" />
        </motion.button>
      </div>
    </motion.section>
  );
};

export default Footer;
