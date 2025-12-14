import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
  	container: {
  		center: true,
  		padding: '2rem',
  		screens: {
  			'2xl': '1400px'
  		}
  	},
  	extend: {
  		letterSpacing: {
  			'widest-plus': '0.15em',
  		},
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			success: {
  				DEFAULT: 'hsl(var(--success))',
  				foreground: 'hsl(var(--success-foreground))'
  			},
  			warning: {
  				DEFAULT: 'hsl(var(--warning))',
  				foreground: 'hsl(var(--warning-foreground))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
		borderRadius: {
			lg: 'var(--radius)',
			md: 'calc(var(--radius) - 2px)',
			sm: 'calc(var(--radius) - 4px)'
		},
		boxShadow: {
			'card': 'var(--shadow-card)',
			'card-hover': 'var(--shadow-card-hover)',
			'card-active': 'var(--shadow-card-active)',
		},
		keyframes: {
			'shake': {
				'0%, 100%': { transform: 'translateX(0)' },
				'10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-4px)' },
				'20%, 40%, 60%, 80%': { transform: 'translateX(4px)' },
			},
			'accordion-down': {
				from: {
					height: '0'
				},
				to: {
					height: 'var(--radix-accordion-content-height)'
				}
			},
			'accordion-up': {
				from: {
					height: 'var(--radix-accordion-content-height)'
				},
				to: {
					height: '0'
				}
			},
			'fade-in': {
				'0%': {
					opacity: '0',
					transform: 'translateY(8px)'
				},
				'100%': {
					opacity: '1',
					transform: 'translateY(0)'
				}
			},
			'fade-out': {
				'0%': {
					opacity: '1',
					transform: 'translateY(0)'
				},
				'100%': {
					opacity: '0',
					transform: 'translateY(8px)'
				}
			},
			'scale-in': {
				'0%': {
					transform: 'scale(0.95)',
					opacity: '0'
				},
				'100%': {
					transform: 'scale(1)',
					opacity: '1'
				}
			},
			'slide-in-right': {
				'0%': {
					transform: 'translateX(-8px)',
					opacity: '0'
				},
				'100%': {
					transform: 'translateX(0)',
					opacity: '1'
				}
			},
			'slide-up': {
				'0%': {
					opacity: '0',
					transform: 'translateY(16px)'
				},
				'100%': {
					opacity: '1',
					transform: 'translateY(0)'
				}
			},
			'shimmer': {
				'100%': {
					transform: 'translateX(100%)'
				}
			},
			'pulse-subtle': {
				'0%, 100%': {
					opacity: '1'
				},
				'50%': {
					opacity: '0.7'
				}
			},
			'toast-slide-in': {
				'0%': {
					opacity: '0',
					transform: 'translateX(100%) scale(0.95)'
				},
				'100%': {
					opacity: '1',
					transform: 'translateX(0) scale(1)'
				}
			},
			'toast-slide-out': {
				'0%': {
					opacity: '1',
					transform: 'translateX(0) scale(1)'
				},
				'100%': {
					opacity: '0',
					transform: 'translateX(100%) scale(0.95)'
				}
			},
			'toast-swipe-out': {
				'0%': {
					opacity: '1',
					transform: 'translateX(var(--radix-toast-swipe-end-x))'
				},
				'100%': {
					opacity: '0',
					transform: 'translateX(100%)'
				}
			}
		},
		animation: {
			'shake': 'shake 0.5s ease-in-out',
			'accordion-down': 'accordion-down 0.2s ease-out',
			'accordion-up': 'accordion-up 0.2s ease-out',
			'fade-in': 'fade-in 0.3s ease-out forwards',
			'fade-out': 'fade-out 0.3s ease-out forwards',
			'scale-in': 'scale-in 0.2s ease-out forwards',
			'slide-in-right': 'slide-in-right 0.2s ease-out forwards',
			'slide-up': 'slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
			'shimmer': 'shimmer 2s infinite',
			'pulse-subtle': 'pulse-subtle 2s ease-in-out infinite',
			'toast-slide-in': 'toast-slide-in 0.35s cubic-bezier(0.21, 1.02, 0.73, 1) forwards',
			'toast-slide-out': 'toast-slide-out 0.3s cubic-bezier(0.06, 0.71, 0.55, 1) forwards',
			'toast-swipe-out': 'toast-swipe-out 0.2s ease-out forwards'
		},
  		fontFamily: {
  			sans: [
  				'Inter',
  				'ui-sans-serif',
  				'system-ui',
  				'sans-serif',
  				'Apple Color Emoji',
  				'Segoe UI Emoji',
  				'Segoe UI Symbol',
  				'Noto Color Emoji'
  			],
  			serif: [
  				'Playfair Display',
  				'ui-serif',
  				'Georgia',
  				'Cambria',
  				'Times New Roman',
  				'Times',
  				'serif'
  			],
  			mono: [
  				'ui-monospace',
  				'SFMono-Regular',
  				'Menlo',
  				'Monaco',
  				'Consolas',
  				'Liberation Mono',
  				'Courier New',
  				'monospace'
  			]
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
