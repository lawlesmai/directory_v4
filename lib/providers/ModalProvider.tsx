'use client'

import React, { 
  createContext, 
  useContext, 
  useState, 
  useCallback, 
  useRef, 
  useEffect,
  ReactNode 
} from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface ModalConfig {
  id: string
  component: React.ComponentType<any>
  props?: Record<string, any>
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full' | 'auto'
  variant?: 'center' | 'bottom-sheet' | 'fullscreen' | 'side-panel'
  backdrop?: 'blur' | 'dark' | 'light' | 'none'
  closeOnBackdrop?: boolean
  closeOnEscape?: boolean
  preventScroll?: boolean
  focusTrap?: boolean
  persistent?: boolean
  urlState?: boolean
  urlParam?: string
  mobileVariant?: 'bottom-sheet' | 'fullscreen' | 'center'
  className?: string
  onOpen?: () => void
  onClose?: () => void
  onAfterOpen?: () => void
  onAfterClose?: () => void
}

interface ModalState {
  config: ModalConfig
  isOpen: boolean
  isAnimating: boolean
  openedAt: number
}

interface ModalContextType {
  openModal: (config: Omit<ModalConfig, 'id'> & { id?: string }) => string
  closeModal: (modalId?: string, force?: boolean) => void
  closeAllModals: (force?: boolean) => void
  modals: ModalState[]
  activeModal: string | null
  isAnyModalOpen: boolean
  getModal: (modalId: string) => ModalState | undefined
}

const ModalContext = createContext<ModalContextType | null>(null)

export const useModal = () => {
  const context = useContext(ModalContext)
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider')
  }
  return context
}

interface ModalProviderProps {
  children: ReactNode
}

const generateModalId = () => `modal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

export const ModalProvider: React.FC<ModalProviderProps> = ({ children }) => {
  const [modals, setModals] = useState<Map<string, ModalState>>(new Map())
  const [modalStack, setModalStack] = useState<string[]>([])
  const router = useRouter()
  const searchParams = useSearchParams()
  const previousActiveElementRef = useRef<HTMLElement | null>(null)

  // Get current modal states
  const modalList = Array.from(modals.values())
  const activeModal = modalStack[modalStack.length - 1] || null
  const isAnyModalOpen = modalStack.length > 0

  // Body scroll management
  const preventBodyScroll = useCallback((prevent: boolean) => {
    if (typeof document === 'undefined') return

    if (prevent) {
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
      document.body.style.overflow = 'hidden'
      document.body.style.paddingRight = `${scrollbarWidth}px`
    } else {
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
    }
  }, [])

  // URL state management
  const updateUrlState = useCallback((modalId: string | null, config?: ModalConfig) => {
    if (!config?.urlState) return

    const current = new URLSearchParams(Array.from(searchParams.entries()))
    const paramName = config.urlParam || 'modal'

    if (modalId && config) {
      current.set(paramName, modalId)
    } else {
      current.delete(paramName)
    }

    const search = current.toString()
    const query = search ? `?${search}` : ''
    
    // Use replace to avoid adding to browser history for modal state
    router.replace(`${window.location.pathname}${query}`, { scroll: false })
  }, [searchParams, router])

  // Open modal
  const openModal = useCallback((config: Omit<ModalConfig, 'id'> & { id?: string }) => {
    const modalId = config.id || generateModalId()
    const modalConfig: ModalConfig = {
      size: 'md',
      variant: 'center',
      backdrop: 'blur',
      closeOnBackdrop: true,
      closeOnEscape: true,
      preventScroll: true,
      focusTrap: true,
      persistent: false,
      urlState: false,
      mobileVariant: 'center',
      ...config,
      id: modalId
    }

    // Store current active element for focus restoration
    if (modalConfig.focusTrap && document.activeElement) {
      previousActiveElementRef.current = document.activeElement as HTMLElement
    }

    const modalState: ModalState = {
      config: modalConfig,
      isOpen: true,
      isAnimating: true,
      openedAt: Date.now()
    }

    setModals(prev => new Map(prev).set(modalId, modalState))
    setModalStack(prev => [...prev, modalId])

    // Handle body scroll prevention
    if (modalConfig.preventScroll) {
      preventBodyScroll(true)
    }

    // Update URL state if needed
    updateUrlState(modalId, modalConfig)

    // Call onOpen callback
    modalConfig.onOpen?.()

    // Handle after open callback
    setTimeout(() => {
      setModals(prev => {
        const updated = new Map(prev)
        const modal = updated.get(modalId)
        if (modal) {
          modal.isAnimating = false
          updated.set(modalId, modal)
        }
        return updated
      })
      modalConfig.onAfterOpen?.()
    }, 300)

    return modalId
  }, [preventBodyScroll, updateUrlState])

  // Close modal
  const closeModal = useCallback((modalId?: string, force = false) => {
    const targetId = modalId || activeModal
    if (!targetId) return

    const modalState = modals.get(targetId)
    if (!modalState) return

    if (modalState.config.persistent && !force) return

    // Start closing animation
    setModals(prev => {
      const updated = new Map(prev)
      const modal = updated.get(targetId)
      if (modal) {
        modal.isAnimating = true
        updated.set(targetId, modal)
      }
      return updated
    })

    // Call onClose callback
    modalState.config.onClose?.()

    // Remove from stack and cleanup after animation
    setTimeout(() => {
      setModals(prev => {
        const updated = new Map(prev)
        updated.delete(targetId)
        return updated
      })

      setModalStack(prev => prev.filter(id => id !== targetId))

      // Restore body scroll if no modals remain
      const remainingModals = modalStack.filter(id => id !== targetId)
      if (remainingModals.length === 0 && modalState.config.preventScroll) {
        preventBodyScroll(false)
      }

      // Restore focus if this was the last modal with focus trap
      if (modalState.config.focusTrap && previousActiveElementRef.current && remainingModals.length === 0) {
        previousActiveElementRef.current.focus()
        previousActiveElementRef.current = null
      }

      // Update URL state
      const lastModal = remainingModals.length > 0 
        ? modals.get(remainingModals[remainingModals.length - 1]) 
        : null
      
      if (modalState.config.urlState) {
        updateUrlState(null, modalState.config)
      }

      // Call onAfterClose callback
      modalState.config.onAfterClose?.()
    }, 300)
  }, [activeModal, modals, modalStack, preventBodyScroll, updateUrlState])

  // Close all modals
  const closeAllModals = useCallback((force = false) => {
    modalStack.forEach(modalId => {
      closeModal(modalId, force)
    })
  }, [modalStack, closeModal])

  // Get modal by ID
  const getModal = useCallback((modalId: string) => {
    return modals.get(modalId)
  }, [modals])

  // Keyboard event handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!activeModal) return

      const modalState = modals.get(activeModal)
      if (!modalState) return

      if (e.key === 'Escape' && modalState.config.closeOnEscape) {
        e.preventDefault()
        closeModal(activeModal)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [activeModal, modals, closeModal])

  // URL state synchronization on mount
  useEffect(() => {
    const modalParam = searchParams.get('modal')
    if (modalParam && !modals.has(modalParam)) {
      // Handle case where URL has modal param but modal is not open
      // This could happen on page refresh or direct navigation
      const current = new URLSearchParams(Array.from(searchParams.entries()))
      current.delete('modal')
      const search = current.toString()
      const query = search ? `?${search}` : ''
      router.replace(`${window.location.pathname}${query}`, { scroll: false })
    }
  }, [searchParams, modals, router])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      preventBodyScroll(false)
      if (previousActiveElementRef.current) {
        previousActiveElementRef.current.focus()
      }
    }
  }, [preventBodyScroll])

  const contextValue: ModalContextType = {
    openModal,
    closeModal,
    closeAllModals,
    modals: modalList,
    activeModal,
    isAnyModalOpen,
    getModal
  }

  return (
    <ModalContext.Provider value={contextValue}>
      {children}
      <ModalRenderer />
    </ModalContext.Provider>
  )
}

// Modal renderer component
const ModalRenderer: React.FC = () => {
  const { modals, closeModal } = useModal()

  return (
    <div className="modal-container">
      <AnimatePresence mode="wait">
        {modals
          .filter(modal => modal.isOpen)
          .map((modalState, index) => (
            <ModalWrapper 
              key={modalState.config.id}
              modalState={modalState}
              stackIndex={index}
              onClose={() => closeModal(modalState.config.id)}
            />
          ))}
      </AnimatePresence>
    </div>
  )
}

// Individual modal wrapper
interface ModalWrapperProps {
  modalState: ModalState
  stackIndex: number
  onClose: () => void
}

const ModalWrapper: React.FC<ModalWrapperProps> = ({ modalState, stackIndex, onClose }) => {
  const { config } = modalState
  const modalRef = useRef<HTMLDivElement>(null)
  const [isMobile, setIsMobile] = useState(false)

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Determine active variant based on device
  const activeVariant = isMobile ? (config.mobileVariant || config.variant) : config.variant

  // Handle backdrop click
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget && config.closeOnBackdrop) {
      onClose()
    }
  }, [config.closeOnBackdrop, onClose])

  // Focus trap implementation
  useEffect(() => {
    if (!config.focusTrap || !modalRef.current) return

    const modal = modalRef.current
    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    
    if (focusableElements.length === 0) return

    const firstElement = focusableElements[0] as HTMLElement
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement.focus()
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement.focus()
        }
      }
    }

    modal.addEventListener('keydown', handleTabKey)
    firstElement.focus()

    return () => {
      modal.removeEventListener('keydown', handleTabKey)
    }
  }, [config.focusTrap])

  // Animation variants
  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 }
  }

  const getModalVariants = () => {
    switch (activeVariant) {
      case 'bottom-sheet':
        return {
          hidden: { opacity: 0, y: '100%' },
          visible: { opacity: 1, y: 0 },
          exit: { opacity: 0, y: '100%' }
        }
      case 'fullscreen':
        return {
          hidden: { opacity: 0, scale: 0.9 },
          visible: { opacity: 1, scale: 1 },
          exit: { opacity: 0, scale: 0.9 }
        }
      case 'side-panel':
        return {
          hidden: { opacity: 0, x: '100%' },
          visible: { opacity: 1, x: 0 },
          exit: { opacity: 0, x: '100%' }
        }
      case 'center':
      default:
        return {
          hidden: { opacity: 0, scale: 0.95, y: -20 },
          visible: { opacity: 1, scale: 1, y: 0 },
          exit: { opacity: 0, scale: 0.95, y: -20 }
        }
    }
  }

  const modalVariants = getModalVariants()

  // Get backdrop style
  const getBackdropClass = () => {
    const base = 'fixed inset-0 flex items-center justify-center p-4 z-50'
    
    switch (config.backdrop) {
      case 'blur':
        return cn(base, 'bg-black/50 backdrop-blur-md')
      case 'dark':
        return cn(base, 'bg-black/75')
      case 'light':
        return cn(base, 'bg-white/75')
      case 'none':
        return cn(base, 'bg-transparent pointer-events-none')
      default:
        return cn(base, 'bg-black/50 backdrop-blur-md')
    }
  }

  // Get modal container class
  const getModalContainerClass = () => {
    const base = 'relative w-full'
    
    // Size classes
    const sizeClasses = {
      sm: 'max-w-sm',
      md: 'max-w-md',
      lg: 'max-w-lg',
      xl: 'max-w-xl',
      full: 'max-w-none w-screen h-screen',
      auto: 'max-w-fit'
    }

    // Variant-specific classes
    const variantClasses = {
      'center': 'mx-auto',
      'bottom-sheet': isMobile ? 'w-full max-w-none fixed bottom-0 left-0 right-0 rounded-t-2xl' : 'mx-auto rounded-lg',
      'fullscreen': 'w-screen h-screen max-w-none fixed inset-0',
      'side-panel': 'fixed right-0 top-0 bottom-0 w-96 max-w-none'
    }

    return cn(
      base,
      sizeClasses[config.size || 'md'],
      variantClasses[activeVariant || 'center'],
      config.className
    )
  }

  const Component = config.component

  return (
    <motion.div
      className={getBackdropClass()}
      style={{ zIndex: 1000 + stackIndex }}
      variants={backdropVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      onClick={handleBackdropClick}
    >
      <motion.div
        ref={modalRef}
        className={getModalContainerClass()}
        variants={modalVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={{ 
          duration: 0.3, 
          ease: [0.25, 0.46, 0.45, 0.94],
          delay: modalState.isAnimating ? 0 : 0.1 
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Component 
          {...(config.props || {})} 
          onClose={onClose}
          modalId={config.id}
        />
      </motion.div>
    </motion.div>
  )
}

export default ModalProvider