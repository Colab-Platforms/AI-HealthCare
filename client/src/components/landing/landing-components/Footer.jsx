import { Link } from "react-router-dom";
import { motion } from "framer-motion";

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

  return (
    <motion.section
      {...fadeIn}
      className="bg-landing-text text-white/60 rounded-tl-[100px] rounded-tr-[100px]"
    >
      <div className="container mx-auto py-10 px-5 flex flex-col justify-between items-center gap-10 ">
        <motion.div
          {...fadeUp}
          className="flex flex-col md:flex-row gap-16 items-start py-8 justify-between w-full"
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
                {item.items.map((item, index) => (
                  <li
                    key={index}
                    className="text-white/80 hover:text-white transition"
                  >
                    <Link to={item.link}>{item.name}</Link>
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
                className="text-white absolute right-0  bottom-2"
              >
                Subscribe
              </button>
            </form>
          </motion.div>
        </motion.div>
        <div className="flex justify-between w-full border-t border-white/10 pt-5">
          <p>© 2026 FitCure Inc. All rights reserved.</p>
          <p>Designed with purpose. Priced with care.</p>
        </div>
      </div>
    </motion.section>
  );
};

export default Footer;
