/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Tema claro. Os nomes dos tokens (ink/mist/diamond/champagne) foram
        // mantidos iguais para não precisar mexer em cada tela — só o valor
        // de cada um mudou, então a troca de tema acontece toda aqui.
        ink: {
          DEFAULT: "#F4F5F7",
          900: "#F4F5F7", // fundo da página
          800: "#FFFFFF", // fundo de cartões/menu
          700: "#F1F2F5", // fundo de campos e hover
          600: "#E2E4EA", // bordas
          500: "#C7CCD6", // bordas mais fortes / anel de foco
        },
        mist: {
          100: "#171A21", // texto principal
          300: "#3D4354", // rótulos e texto secundário forte
          500: "#646B7C", // texto secundário
          700: "#9AA0AD", // texto bem discreto / placeholder
        },
        diamond: {
          DEFAULT: "#0E7C91",
          soft: "#0AA0B8",
          dim: "#8FD9E3",
        },
        champagne: {
          DEFAULT: "#A9812E",
          soft: "#C9A66B",
          dim: "#EDE0C3",
        },
        danger: "#D1435B",
        success: "#1E9A5A",
        warn: "#C3821A",
      },
      fontFamily: {
        // Fonte única, legível e de aparência profissional em todo o
        // sistema — inclusive nos títulos, que antes usavam uma serifada
        // decorativa (Cormorant Garamond).
        display: ["'Manrope'", "sans-serif"],
        body: ["'Manrope'", "sans-serif"],
      },
    },
  },
  plugins: [],
};

