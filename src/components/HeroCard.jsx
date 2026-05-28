import { Box } from "@chakra-ui/react";
import { useColorModeValue } from "@chakra-ui/react";

export default function HeroCard({ children, ...props }) {
  const bg = useColorModeValue("rgba(255, 255, 255, 0.72)", "rgba(17, 24, 39, 0.76)");
  const borderColor = useColorModeValue("rgba(255, 255, 255, 0.78)", "rgba(255, 255, 255, 0.12)");
  const shadow = useColorModeValue("0 22px 70px rgba(60, 72, 95, 0.14)", "0 22px 70px rgba(0, 0, 0, 0.32)");

  return (
    <Box
      bg={bg}
      border="1px solid"
      borderColor={borderColor}
      borderRadius={{ base: "24px", md: "28px" }}
      boxShadow={shadow}
      backdropFilter="blur(22px)"
      {...props}
    >
      {children}
    </Box>
  );
}
