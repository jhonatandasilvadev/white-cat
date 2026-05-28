import { createStandaloneToast } from "@chakra-ui/react";
import theme from "./theme.js";

const { ToastContainer, toast } = createStandaloneToast({ theme });

export function notify(options) {
  toast({
    position: "top-right",
    duration: 3500,
    isClosable: true,
    ...options,
  });
}

export { ToastContainer };
