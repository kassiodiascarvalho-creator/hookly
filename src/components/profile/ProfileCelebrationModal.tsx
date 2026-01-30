import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gift, Sparkles, PartyPopper, Coins, CheckCircle2 } from "lucide-react";
import { ConfettiAnimation } from "./ConfettiAnimation";

interface ProfileCelebrationModalProps {
  open: boolean;
  onClose: () => void;
  bonusCredits: number;
  userType: "freelancer" | "company";
}

export function ProfileCelebrationModal({
  open,
  onClose,
  bonusCredits,
  userType,
}: ProfileCelebrationModalProps) {
  const { t } = useTranslation();

  return (
    <>
      <ConfettiAnimation isActive={open} duration={5000} />
      
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="sm:max-w-md border-0 bg-gradient-to-br from-primary/10 via-background to-amber-500/10 overflow-visible">
          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: "spring", duration: 0.5 }}
                className="flex flex-col items-center text-center py-4"
              >
                {/* Animated icon container */}
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", delay: 0.2, duration: 0.8 }}
                  className="relative mb-6"
                >
                  {/* Glow effect */}
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-primary rounded-full blur-xl opacity-50 animate-pulse" />
                  
                  {/* Main icon */}
                  <div className="relative h-24 w-24 rounded-full bg-gradient-to-br from-amber-400 via-amber-500 to-primary flex items-center justify-center shadow-2xl">
                    <motion.div
                      animate={{ 
                        rotate: [0, -10, 10, -10, 0],
                        scale: [1, 1.1, 1]
                      }}
                      transition={{ 
                        duration: 0.5, 
                        delay: 0.5,
                        repeat: 2,
                        repeatDelay: 1
                      }}
                    >
                      <PartyPopper className="h-12 w-12 text-white" />
                    </motion.div>
                  </div>
                  
                  {/* Floating sparkles */}
                  <motion.div
                    animate={{ 
                      y: [-5, 5, -5],
                      rotate: [0, 15, 0]
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute -top-2 -right-2"
                  >
                    <Sparkles className="h-6 w-6 text-amber-400" />
                  </motion.div>
                  <motion.div
                    animate={{ 
                      y: [5, -5, 5],
                      rotate: [0, -15, 0]
                    }}
                    transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                    className="absolute -bottom-1 -left-2"
                  >
                    <Sparkles className="h-5 w-5 text-primary" />
                  </motion.div>
                </motion.div>

                {/* Title */}
                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-2xl font-bold bg-gradient-to-r from-amber-500 via-primary to-amber-500 bg-clip-text text-transparent mb-2"
                >
                  {t("profileCompletion.celebrationModalTitle", "🎉 Parabéns!")}
                </motion.h2>

                {/* Subtitle */}
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-lg font-medium text-foreground mb-2"
                >
                  {t("profileCompletion.celebrationModalSubtitle", "Seu perfil está 100% completo!")}
                </motion.p>

                {/* Description */}
                <motion.p
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="text-muted-foreground mb-6 max-w-sm"
                >
                  {userType === "freelancer"
                    ? t("profileCompletion.celebrationModalDescFreelancer", "Agora você está pronto para enviar propostas e conquistar clientes!")
                    : t("profileCompletion.celebrationModalDescCompany", "Agora você está pronto para publicar projetos e encontrar talentos!")}
                </motion.p>

                {/* Bonus badge */}
                {bonusCredits > 0 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.6, type: "spring" }}
                    className="mb-6"
                  >
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-primary rounded-full blur-md opacity-50 animate-pulse" />
                      <Badge 
                        className="relative text-lg px-6 py-3 bg-gradient-to-r from-amber-500 to-primary text-white border-0 shadow-lg gap-2"
                      >
                        <Gift className="h-5 w-5" />
                        <span>+{bonusCredits}</span>
                        <Coins className="h-5 w-5" />
                        <span>{t("profileCompletion.creditsAwarded", "Créditos!")}</span>
                      </Badge>
                    </div>
                  </motion.div>
                )}

                {/* Checkmarks */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.7 }}
                  className="flex flex-wrap justify-center gap-2 mb-6"
                >
                  {[
                    t("profileCompletion.benefit1", "Perfil completo"),
                    t("profileCompletion.benefit2", "Maior visibilidade"),
                    t("profileCompletion.benefit3", "Pronto para começar"),
                  ].map((benefit, i) => (
                    <motion.div
                      key={benefit}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.8 + i * 0.1 }}
                    >
                      <Badge variant="secondary" className="gap-1">
                        <CheckCircle2 className="h-3 w-3 text-green-500" />
                        {benefit}
                      </Badge>
                    </motion.div>
                  ))}
                </motion.div>

                {/* CTA Button */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9 }}
                  className="w-full"
                >
                  <Button 
                    onClick={onClose}
                    className="w-full bg-gradient-to-r from-primary to-amber-500 hover:from-primary/90 hover:to-amber-500/90 text-white font-semibold py-6 text-lg shadow-lg"
                  >
                    {t("profileCompletion.letsGo", "Vamos lá!")}
                  </Button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </DialogContent>
      </Dialog>
    </>
  );
}
