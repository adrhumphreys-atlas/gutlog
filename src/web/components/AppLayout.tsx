import { Outlet, NavLink } from 'react-router-dom'
import { useState } from 'react'

const navItems = [
  { to: '/', label: 'Today', emoji: '📋' },
  { to: '/insights', label: 'Insights', emoji: '🔍' },
  { to: '/experiments', label: 'Experiments', emoji: '🧪' },
  { to: '/settings', label: 'Settings', emoji: '⚙️' },
]

/**
 * AppLayout — Responsive layout with sidebar (≥769px) or bottom nav (<769px)
 *
 * ┌──────────┬──────────────────────┐
 * │ Sidebar  │                      │  ≥769px
 * │ (nav)    │   <main> content     │
 * │          │                      │
 * └──────────┴──────────────────────┘
 *
 * ┌──────────────────────┐
 * │                      │  <769px
 * │   <main> content     │
 * │                      │
 * ├──────────────────────┤
 * │     Bottom Nav       │
 * └──────────────────────┘
 */
export function AppLayout() {
  return (
    <div className="min-h-dvh flex flex-col md-plus:flex-row">
      {/* Desktop Sidebar — hidden below 769px */}
      <aside className="hidden md-plus:flex flex-col w-52 border-r border-stone-200 bg-white p-4 gap-1">
        <div className="text-xl font-bold text-green-800 mb-6 px-3">
          🌿 GutLog
        </div>
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-green-50 text-green-800'
                  : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
              }`
            }
          >
            <span className="text-lg">{item.emoji}</span>
            {item.label}
          </NavLink>
        ))}
      </aside>

      {/* Main Content */}
      <main className="flex-1 pb-20 md-plus:pb-0">
        <Outlet />
      </main>

      {/* Mobile Bottom Nav — hidden at ≥769px */}
      <nav className="md-plus:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 flex justify-around py-2 px-4 z-40">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 py-1 px-3 min-w-[44px] min-h-[44px] justify-center ${
                isActive ? 'text-green-800' : 'text-stone-400'
              }`
            }
          >
            <span className="text-xl">{item.emoji}</span>
            <span className="text-[10px] font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Toast container (global) */}
      <div id="toast-container" className="fixed top-4 right-4 z-50" />
    </div>
  )
}
