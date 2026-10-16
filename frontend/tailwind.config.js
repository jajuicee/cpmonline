/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Montserrat', 'sans-serif'],
                montserrat: ['Montserrat', 'sans-serif'],
            },
            colors: {
                brand: {
                    cream: '#F4F1E1', // The warm off-white background of the logo
                    black: '#2C2C2A', // The soft charcoal color of the text/paddle
                    hover: '#3F3F3C', 
                }
            }
        },
    },
    plugins: [],
}