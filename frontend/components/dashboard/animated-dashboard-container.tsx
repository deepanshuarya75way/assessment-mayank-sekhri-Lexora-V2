"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } }
};

interface Props {
  header: ReactNode;
  kpis: ReactNode[];
  upload?: ReactNode;
  list: ReactNode;
}

export function AnimatedDashboardContainer({ header, kpis, upload, list }: Props) {
  return (
    <motion.section 
      className="w-full space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={itemVariants}>
        {header}
      </motion.div>
      
      <motion.div variants={itemVariants} className="grid gap-4 sm:grid-cols-3">
        {kpis.map((kpi, i) => (
          <motion.div key={i} whileHover={{ y: -5 }} transition={{ type: "spring", stiffness: 300 }}>
            {kpi}
          </motion.div>
        ))}
      </motion.div>

      {upload && (
        <motion.div id="upload-section" variants={itemVariants} className="scroll-mt-6">
          {upload}
        </motion.div>
      )}

      <motion.div variants={itemVariants}>
        {list}
      </motion.div>
    </motion.section>
  );
}
