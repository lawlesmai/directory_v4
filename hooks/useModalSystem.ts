import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

export interface ModalConfig {
  id: string;
  component: React.ComponentType<any>;
  props?: Record<string, any>;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  position?: 'center' | 'top' | 'bottom';
  backdrop?: 'blur' | 'dark' | 'light' | 'none';
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  preventScroll?: boolean;
  focusTrap?: boolean;
  persistent?: boolean;
  animation?: 'fade' | 'slide' | 'scale' | 'none';
  animationDuration?: number;
  zIndex?: number;
  className?: string;
  onOpen?: () => void;
  onClose?: () => void;
  onAfterOpen?: () => void;
  onAfterClose?: () => void;
}

export interface ModalState {
  isOpen: boolean;
  isAnimating: boolean;
  animationPhase: 'entering' | 'entered' | 'exiting' | 'exited';
  openedAt: number;
  config: ModalConfig;
}

export interface ModalSystemState {
  modals: Map<string, ModalState>;
  activeModal: string | null;
  modalStack: string[];
  isAnyModalOpen: boolean;
  modalCount: number;
}

export interface FocusTrapOptions {
  enabled: boolean;
  initialFocus?: HTMLElement | string;
  returnFocus?: boolean;
  allowOutsideClick?: boolean;
}

export interface ModalMetrics {
  totalOpened: number;
  averageOpenDuration: number;
  mostUsedModals: Record<string, number>;
  currentOpenDuration: number;
}

const DEFAULT_CONFIG: Partial<ModalConfig> = {
  size: 'md',
  position: 'center',
  backdrop: 'blur',
  closeOnBackdrop: true,
  closeOnEscape: true,
  preventScroll: true,
  focusTrap: true,
  persistent: false,
  animation: 'scale',
  animationDuration: 300,
  zIndex: 1000
};

const FOCUSABLE_ELEMENTS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]'
].join(',');

export const useModalSystem = () => {
  // State
  const [state, setState] = useState<ModalSystemState>({
    modals: new Map(),
    activeModal: null,
    modalStack: [],
    isAnyModalOpen: false,
    modalCount: 0
  });

  const [metrics, setMetrics] = useState<ModalMetrics>({
    totalOpened: 0,
    averageOpenDuration: 0,
    mostUsedModals: {},
    currentOpenDuration: 0
  });

  // Refs
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const modalRefs = useRef<Map<string, HTMLElement>>(new Map());
  const animationTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const focusTrapRefs = useRef<Map<string, HTMLElement[]>>(new Map());
  const modalUsageRef = useRef<Record<string, number>>({});
  const openDurationsRef = useRef<number[]>([]);

  // Generate unique modal ID
  const generateModalId = useCallback((prefix = 'modal') => {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Get modal animation styles
  const getModalAnimationStyles = useCallback((
    animation: ModalConfig['animation'],
    phase: ModalState['animationPhase'],
    size: ModalConfig['size'] = 'md'
  ): React.CSSProperties => {
    const baseStyles: React.CSSProperties = {
      transitionProperty: 'all',
      transitionDuration: '300ms',
      transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)'
    };

    const sizeStyles: Record<string, React.CSSProperties> = {
      sm: { maxWidth: '24rem' },
      md: { maxWidth: '32rem' },
      lg: { maxWidth: '48rem' },
      xl: { maxWidth: '64rem' },
      full: { width: '100vw', height: '100vh', maxWidth: 'none' }
    };

    switch (animation) {
      case 'fade':
        return {
          ...baseStyles,
          ...sizeStyles[size],
          opacity: phase === 'entering' || phase === 'entered' ? 1 : 0
        };

      case 'slide':
        return {
          ...baseStyles,
          ...sizeStyles[size],
          transform: phase === 'entering' || phase === 'entered' 
            ? 'translateY(0)' 
            : 'translateY(-2rem)',
          opacity: phase === 'entering' || phase === 'entered' ? 1 : 0
        };

      case 'scale':
        return {
          ...baseStyles,
          ...sizeStyles[size],
          transform: phase === 'entering' || phase === 'entered' 
            ? 'scale(1)' 
            : 'scale(0.95)',
          opacity: phase === 'entering' || phase === 'entered' ? 1 : 0
        };

      case 'none':
      default:
        return {
          ...sizeStyles[size],
          opacity: 1
        };
    }
  }, []);

  // Get backdrop styles
  const getBackdropStyles = useCallback((
    backdrop: ModalConfig['backdrop'],
    isVisible: boolean
  ): React.CSSProperties => {
    const baseStyles: React.CSSProperties = {
      position: 'fixed',
      inset: 0,
      transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
      opacity: isVisible ? 1 : 0
    };

    switch (backdrop) {
      case 'blur':
        return {
          ...baseStyles,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: isVisible ? 'blur(8px)' : 'blur(0px)'
        };

      case 'dark':
        return {
          ...baseStyles,
          backgroundColor: isVisible ? 'rgba(0, 0, 0, 0.75)' : 'rgba(0, 0, 0, 0)'
        };

      case 'light':
        return {
          ...baseStyles,
          backgroundColor: isVisible ? 'rgba(255, 255, 255, 0.75)' : 'rgba(255, 255, 255, 0)'
        };

      case 'none':
      default:
        return {
          ...baseStyles,
          backgroundColor: 'transparent',
          pointerEvents: 'none'
        };
    }
  }, []);

  // Focus management
  const getFocusableElements = useCallback((container: HTMLElement): HTMLElement[] => {
    return Array.from(container.querySelectorAll(FOCUSABLE_ELEMENTS)) as HTMLElement[];
  }, []);

  const trapFocus = useCallback((modalId: string, container: HTMLElement) => {
    const focusableElements = getFocusableElements(container);
    focusTrapRefs.current.set(modalId, focusableElements);

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    container.addEventListener('keydown', handleTabKey);

    // Focus the first focusable element
    firstElement.focus();

    return () => {
      container.removeEventListener('keydown', handleTabKey);
      focusTrapRefs.current.delete(modalId);
    };
  }, [getFocusableElements]);

  // Handle body scroll prevention
  const preventBodyScroll = useCallback((prevent: boolean) => {
    if (typeof document === 'undefined') return;

    if (prevent) {
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = `${window.innerWidth - document.documentElement.clientWidth}px`;
    } else {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    }
  }, []);

  // Open modal
  const openModal = useCallback((config: Omit<ModalConfig, 'id'> & { id?: string }) => {
    const modalId = config.id || generateModalId();
    const finalConfig = { ...DEFAULT_CONFIG, ...config, id: modalId } as ModalConfig;

    // Store current active element for focus return
    if (finalConfig.focusTrap && document.activeElement) {
      previousActiveElementRef.current = document.activeElement as HTMLElement;
    }

    const modalState: ModalState = {
      isOpen: true,
      isAnimating: true,
      animationPhase: 'entering',
      openedAt: Date.now(),
      config: finalConfig
    };

    setState(prev => {
      const newModals = new Map(prev.modals);
      newModals.set(modalId, modalState);

      const newStack = [...prev.modalStack, modalId];
      
      return {
        ...prev,
        modals: newModals,
        activeModal: modalId,
        modalStack: newStack,
        isAnyModalOpen: true,
        modalCount: newModals.size
      };
    });

    // Prevent body scroll if requested
    if (finalConfig.preventScroll) {
      preventBodyScroll(true);
    }

    // Track usage
    modalUsageRef.current[modalId] = (modalUsageRef.current[modalId] || 0) + 1;
    setMetrics(prev => ({
      ...prev,
      totalOpened: prev.totalOpened + 1,
      mostUsedModals: { ...modalUsageRef.current }
    }));

    // Call onOpen callback
    finalConfig.onOpen?.();

    // Handle animation
    const animationTimeout = setTimeout(() => {
      setState(prev => {
        const updatedModals = new Map(prev.modals);
        const modal = updatedModals.get(modalId);
        if (modal) {
          modal.animationPhase = 'entered';
          modal.isAnimating = false;
          updatedModals.set(modalId, modal);
        }
        return { ...prev, modals: updatedModals };
      });

      finalConfig.onAfterOpen?.();
      animationTimeoutsRef.current.delete(modalId);
    }, finalConfig.animationDuration || DEFAULT_CONFIG.animationDuration!);

    animationTimeoutsRef.current.set(modalId, animationTimeout);

    return modalId;
  }, [generateModalId, preventBodyScroll]);

  // Close modal
  const closeModal = useCallback((modalId: string, force = false) => {
    const modalState = state.modals.get(modalId);
    if (!modalState) return;

    if (modalState.config.persistent && !force) return;

    // Calculate open duration
    const openDuration = Date.now() - modalState.openedAt;
    openDurationsRef.current.push(openDuration);
    if (openDurationsRef.current.length > 50) {
      openDurationsRef.current.shift();
    }

    // Update metrics
    setMetrics(prev => ({
      ...prev,
      averageOpenDuration: openDurationsRef.current.reduce((a, b) => a + b, 0) / openDurationsRef.current.length
    }));

    // Start closing animation
    setState(prev => {
      const updatedModals = new Map(prev.modals);
      const modal = updatedModals.get(modalId);
      if (modal) {
        modal.animationPhase = 'exiting';
        modal.isAnimating = true;
        updatedModals.set(modalId, modal);
      }
      return { ...prev, modals: updatedModals };
    });

    modalState.config.onClose?.();

    // Handle animation and cleanup
    const animationTimeout = setTimeout(() => {
      setState(prev => {
        const updatedModals = new Map(prev.modals);
        updatedModals.delete(modalId);

        const newStack = prev.modalStack.filter(id => id !== modalId);
        const newActiveModal = newStack.length > 0 ? newStack[newStack.length - 1] : null;
        const isAnyOpen = updatedModals.size > 0;

        return {
          ...prev,
          modals: updatedModals,
          activeModal: newActiveModal,
          modalStack: newStack,
          isAnyModalOpen: isAnyOpen,
          modalCount: updatedModals.size
        };
      });

      // Restore body scroll if no modals are open
      if (state.modalStack.length === 1 && modalState.config.preventScroll) {
        preventBodyScroll(false);
      }

      // Restore focus
      if (modalState.config.focusTrap && previousActiveElementRef.current) {
        previousActiveElementRef.current.focus();
        previousActiveElementRef.current = null;
      }

      modalState.config.onAfterClose?.();
      animationTimeoutsRef.current.delete(modalId);
      modalRefs.current.delete(modalId);
    }, modalState.config.animationDuration || DEFAULT_CONFIG.animationDuration!);

    animationTimeoutsRef.current.set(modalId, animationTimeout);
  }, [state.modals, state.modalStack, preventBodyScroll]);

  // Close all modals
  const closeAllModals = useCallback((force = false) => {
    state.modalStack.forEach(modalId => {
      closeModal(modalId, force);
    });
  }, [state.modalStack, closeModal]);

  // Close top modal
  const closeTopModal = useCallback((force = false) => {
    if (state.activeModal) {
      closeModal(state.activeModal, force);
    }
  }, [state.activeModal, closeModal]);

  // Register modal ref
  const registerModalRef = useCallback((modalId: string, element: HTMLElement) => {
    if (!element) return;

    modalRefs.current.set(modalId, element);
    
    const modalState = state.modals.get(modalId);
    if (modalState?.config.focusTrap) {
      trapFocus(modalId, element);
    }
  }, [state.modals, trapFocus]);

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!state.activeModal) return;

      const activeModalState = state.modals.get(state.activeModal);
      if (!activeModalState) return;

      if (e.key === 'Escape' && activeModalState.config.closeOnEscape) {
        e.preventDefault();
        closeModal(state.activeModal);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [state.activeModal, state.modals, closeModal]);

  // Handle backdrop click
  const handleBackdropClick = useCallback((modalId: string, e: React.MouseEvent) => {
    const modalState = state.modals.get(modalId);
    if (!modalState || !modalState.config.closeOnBackdrop) return;

    if (e.target === e.currentTarget) {
      closeModal(modalId);
    }
  }, [state.modals, closeModal]);

  // Get modal by ID
  const getModal = useCallback((modalId: string) => {
    return state.modals.get(modalId);
  }, [state.modals]);

  // Check if modal is open
  const isModalOpen = useCallback((modalId: string) => {
    const modal = state.modals.get(modalId);
    return modal?.isOpen || false;
  }, [state.modals]);

  // Get modal stack
  const getModalStack = useCallback(() => {
    return [...state.modalStack];
  }, [state.modalStack]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      animationTimeoutsRef.current.forEach(timeout => clearTimeout(timeout));
      animationTimeoutsRef.current.clear();
      modalRefs.current.clear();
      focusTrapRefs.current.clear();
      
      // Restore body scroll
      preventBodyScroll(false);
    };
  }, [preventBodyScroll]);

  return {
    // State
    modals: Array.from(state.modals.entries()).map(([id, modal]) => ({ id, ...modal })),
    activeModal: state.activeModal,
    modalStack: state.modalStack,
    isAnyModalOpen: state.isAnyModalOpen,
    modalCount: state.modalCount,
    metrics,

    // Actions
    openModal,
    closeModal,
    closeAllModals,
    closeTopModal,

    // Utilities
    registerModalRef,
    handleBackdropClick,
    getModal,
    isModalOpen,
    getModalStack,
    getModalAnimationStyles,
    getBackdropStyles,

    // Constants
    DEFAULT_CONFIG
  };
};

// Individual modal hook for easier component integration
export const useModal = (config: Omit<ModalConfig, 'id'>) => {
  const modalIdRef = useRef<string | null>(null);
  const { openModal, closeModal, isModalOpen, registerModalRef } = useModalSystem();

  const open = useCallback((props?: Record<string, any>) => {
    if (modalIdRef.current) return modalIdRef.current;
    
    modalIdRef.current = openModal({
      ...config,
      props: { ...config.props, ...props }
    });
    
    return modalIdRef.current;
  }, [openModal, config]);

  const close = useCallback((force = false) => {
    if (modalIdRef.current) {
      closeModal(modalIdRef.current, force);
      modalIdRef.current = null;
    }
  }, [closeModal]);

  const isOpen = modalIdRef.current ? isModalOpen(modalIdRef.current) : false;

  return {
    open,
    close,
    isOpen,
    modalId: modalIdRef.current,
    registerModalRef: modalIdRef.current 
      ? (element: HTMLElement) => registerModalRef(modalIdRef.current!, element)
      : undefined
  };
};

export default useModalSystem;