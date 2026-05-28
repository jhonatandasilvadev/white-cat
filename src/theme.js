import { extendTheme } from "@chakra-ui/react";

const theme = extendTheme({
  config: {
    initialColorMode: "light",
    useSystemColorMode: false,
  },
  fonts: {
    heading: "Manrope, system-ui, sans-serif",
    body: "Manrope, system-ui, sans-serif",
  },
  colors: {
    brand: {
      50: "#eef7ff",
      100: "#d5eaff",
      200: "#add6ff",
      300: "#7abaff",
      400: "#4698f0",
      500: "#2078d4",
      600: "#175ead",
      700: "#164b88",
      800: "#173f71",
      900: "#18365f",
    },
    mint: {
      50: "#effdf5",
      100: "#d7f8e5",
      200: "#b3efcf",
      300: "#7fdfad",
      400: "#49c987",
      500: "#22a968",
      600: "#168750",
      700: "#146b42",
      800: "#145537",
      900: "#12462f",
    },
    lavender: {
      50: "#f7f4ff",
      100: "#ede7ff",
      200: "#d9ceff",
      300: "#b9a7ff",
      400: "#9476ff",
      500: "#7651f4",
      600: "#6036dc",
      700: "#5129b8",
      800: "#442596",
      900: "#392178",
    },
    peach: {
      50: "#fff7ed",
      100: "#ffecd3",
      200: "#ffd5a5",
      300: "#ffb76d",
      400: "#ff8f32",
      500: "#ff7410",
      600: "#f05b06",
      700: "#c74407",
      800: "#9e360e",
      900: "#7f2f0f",
    },
    rose: {
      50: "#fff1f4",
      100: "#ffe4ea",
      200: "#fecdd8",
      300: "#fda4b8",
      400: "#fb718d",
      500: "#f43f65",
      600: "#e11d48",
      700: "#be123c",
      800: "#9f1239",
      900: "#881337",
    },
    sky: {
      50: "#eff9ff",
      100: "#def2ff",
      200: "#b6e7ff",
      300: "#75d5ff",
      400: "#2cc0ff",
      500: "#00a5ee",
      600: "#0084cc",
      700: "#0069a6",
      800: "#075989",
      900: "#0c4a6e",
    },
  },
  styles: {
    global: {
      "html, body": {
        bg: "transparent",
      },
      "body.chakra-ui-dark": {
        color: "gray.100",
        background:
          "radial-gradient(circle at top left, rgba(32, 120, 212, 0.28), transparent 30rem), radial-gradient(circle at top right, rgba(118, 81, 244, 0.25), transparent 34rem), linear-gradient(135deg, #0b1020 0%, #121826 48%, #1a1020 100%)",
      },
    },
  },
  components: {
    Button: {
      baseStyle: {
        borderRadius: "full",
        fontWeight: "700",
      },
    },
    Input: {
      defaultProps: {
        variant: "filled",
      },
    },
    Select: {
      defaultProps: {
        variant: "filled",
      },
    },
    NumberInput: {
      defaultProps: {
        variant: "filled",
      },
    },
    Alert: {
      baseStyle: {
        container: {
          borderRadius: "18px",
          borderWidth: "1px",
        },
      },
    },
  },
});

export default theme;
