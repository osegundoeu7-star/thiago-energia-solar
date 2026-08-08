'use client'
import gsap from 'gsap'
export const fadeUp = (target: gsap.TweenTarget, vars: gsap.TweenVars = {}) => gsap.from(target, { autoAlpha: 0, y: 30, duration: .8, ease: 'power3.out', ...vars })
export const maskReveal = (target: gsap.TweenTarget, vars: gsap.TweenVars = {}) => gsap.from(target, { yPercent: 110, duration: 1, stagger: .08, ease: 'power4.out', ...vars })
export const scaleReveal = (target: gsap.TweenTarget, vars: gsap.TweenVars = {}) => gsap.from(target, { autoAlpha: 0, scale: .94, duration: .8, ease: 'power3.out', ...vars })
