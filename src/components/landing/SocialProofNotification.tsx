import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Notification {
  name: string;
  location: string;
  action: string;
  time: string;
}

const NOTIFICATIONS: Notification[] = [
  { name: "Pedro S.", location: "São Paulo", action: "contratou um dev React", time: "3 min atrás" },
  { name: "Maria L.", location: "Rio de Janeiro", action: "completou um projeto", time: "5 min atrás" },
  { name: "Tech Corp", location: "Curitiba", action: "contratou 2 designers", time: "8 min atrás" },
  { name: "Ana R.", location: "Belo Horizonte", action: "recebeu R$6.800", time: "12 min atrás" },
  { name: "João M.", location: "Porto Alegre", action: "entregou app mobile", time: "15 min atrás" },
];

export function SocialProofNotification() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show first notification after 8 seconds
    const initialTimer = setTimeout(() => {
      setVisible(true);
    }, 8000);

    return () => clearTimeout(initialTimer);
  }, []);

  useEffect(() => {
    if (!visible) return;

    // Hide after 5 seconds, then show next after 20 seconds
    const hideTimer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % NOTIFICATIONS.length);
        setVisible(true);
      }, 20000);
    }, 5000);

    return () => clearTimeout(hideTimer);
  }, [visible, currentIndex]);

  const notification = NOTIFICATIONS[currentIndex];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 50, x: 0 }}
          animate={{ opacity: 1, y: 0, x: 0 }}
          exit={{ opacity: 0, y: 50 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-4 left-4 z-50 hidden md:block"
        >
          <div className="surface-card p-4 shadow-lg max-w-[280px] border-primary/20">
            <div className="flex items-start gap-3">
              <span className="relative flex h-2 w-2 mt-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {notification.name} <span className="text-muted-foreground font-normal">de {notification.location}</span>
                </p>
                <p className="text-xs text-muted-foreground">{notification.action}</p>
                <p className="text-xs text-muted-foreground/60 mt-1">{notification.time}</p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
