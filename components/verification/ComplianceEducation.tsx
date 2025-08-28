'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  CheckCircle,
  Info,
  AlertCircle,
  FileText,
  User,
  Building,
  Lock,
  Eye,
  Clock,
  Award,
  HelpCircle,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassMorphism } from '../GlassMorphism';

export interface ComplianceEducationProps {
  workflowId?: string;
  businessId?: string;
  stepData?: ComplianceEducationData;
  onComplete?: (data: ComplianceEducationData) => void;
  onError?: (errors: string[]) => void;
  isLoading?: boolean;
}

export interface ComplianceEducationData {
  acknowledgedCompliance: boolean;
  readPrivacyPolicy: boolean;
  understoodProcess: boolean;
  agreedToTerms: boolean;
  completedAt: string;
}

interface EducationSection {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  content: string[];
  importance: 'high' | 'medium' | 'low';
}

interface FAQ {
  question: string;
  answer: string;
}

const EDUCATION_SECTIONS: EducationSection[] = [
  {
    id: 'why_kyc',
    title: 'Why Business Verification is Required',
    description: 'Legal and regulatory requirements for business verification',
    icon: Shield,
    importance: 'high',
    content: [
      'Federal regulations require businesses to verify their identity and legitimacy',
      'Helps prevent fraud and money laundering in business transactions',
      'Ensures compliance with Anti-Money Laundering (AML) and Know Your Customer (KYC) laws',
      'Protects both your business and our platform from regulatory violations',
      'Required by financial institutions and payment processors'
    ]
  },
  {
    id: 'what_we_collect',
    title: 'What Information We Collect',
    description: 'Overview of required documents and personal information',
    icon: FileText,
    importance: 'high',
    content: [
      'Business registration documents (license, articles of incorporation)',
      'Tax identification documents (EIN letter, tax registration)',
      'Government-issued photo ID of business owners',
      'Proof of business address',
      'Business bank account information',
      'Beneficial ownership information (owners with 25%+ stake)'
    ]
  },
  {
    id: 'verification_process',
    title: 'The Verification Process',
    description: 'Step-by-step breakdown of what to expect',
    icon: CheckCircle,
    importance: 'medium',
    content: [
      'Document upload and initial review (1-2 business days)',
      'Identity verification using government ID',
      'Business information validation against public records',
      'Manual review by our compliance team if needed',
      'Final approval and account activation',
      'You can track progress in real-time through your dashboard'
    ]
  },
  {
    id: 'data_protection',
    title: 'How We Protect Your Data',
    description: 'Security measures and privacy protections',
    icon: Lock,
    importance: 'high',
    content: [
      'All data transmitted using 256-bit SSL encryption',
      'Documents stored in SOC 2 Type II compliant data centers',
      'Access limited to authorized compliance personnel only',
      'Biometric data automatically deleted after verification',
      'Full GDPR and CCPA compliance for data rights',
      'Regular security audits and penetration testing'
    ]
  },
  {
    id: 'benefits',
    title: 'Benefits of Verification',
    description: 'What you gain from completing verification',
    icon: Award,
    importance: 'medium',
    content: [
      'Verified badge on your business profile increases customer trust',
      'Access to premium features and higher transaction limits',
      'Priority customer support and dedicated account management',
      'Enhanced visibility in search results and recommendations',
      'Eligibility for special programs and partnerships',
      'Reduced transaction fees and processing times'
    ]
  },
  {
    id: 'timeline',
    title: 'Processing Timeline',
    description: 'Expected timeframes for verification completion',
    icon: Clock,
    importance: 'low',
    content: [
      'Standard processing: 2-3 business days',
      'Complex cases may take up to 5-7 business days',
      'Additional information requests may extend timeline',
      'Priority processing available for premium accounts',
      'You will receive email updates at each step',
      'Status updates available 24/7 in your dashboard'
    ]
  }
];

const FAQS: FAQ[] = [
  {
    question: 'Is my personal information secure?',
    answer: 'Yes, we use bank-level security measures including 256-bit SSL encryption, SOC 2 compliance, and strict access controls. Your data is never sold or shared with third parties.'
  },
  {
    question: 'What happens if my verification is rejected?',
    answer: 'If verification is rejected, you will receive detailed feedback on why and what you can do to resolve the issues. You can resubmit corrected documents or appeal the decision within 30 days.'
  },
  {
    question: 'How long is my verification valid?',
    answer: 'Business verifications are typically valid for 2 years. We will notify you before expiration and provide a simple renewal process to maintain your verified status.'
  },
  {
    question: 'Can I use the platform while verification is pending?',
    answer: 'Yes, you can use basic features while verification is pending. However, some premium features and higher transaction limits require completed verification.'
  },
  {
    question: 'What if I don\'t have all the required documents?',
    answer: 'Contact our support team if you\'re missing documents. We can often accept alternative documentation or provide guidance on obtaining the required paperwork.'
  }
];

export const ComplianceEducation: React.FC<ComplianceEducationProps> = ({
  workflowId,
  businessId,
  stepData,
  onComplete,
  onError,
  isLoading = false
}) => {
  const [educationData, setEducationData] = useState<ComplianceEducationData>(
    stepData || {
      acknowledgedCompliance: false,
      readPrivacyPolicy: false,
      understoodProcess: false,
      agreedToTerms: false,
      completedAt: ''
    }
  );

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['why_kyc']));
  const [showFAQ, setShowFAQ] = useState(false);
  const [readSections, setReadSections] = useState<Set<string>>(new Set());

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
      // Mark as read when expanded
      setReadSections(prev => new Set([...prev, sectionId]));
    }
    setExpandedSections(newExpanded);
  };

  const handleCheckboxChange = (field: keyof ComplianceEducationData, value: boolean) => {
    setEducationData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const isComplete = () => {
    return (
      educationData.acknowledgedCompliance &&
      educationData.readPrivacyPolicy &&
      educationData.understoodProcess &&
      educationData.agreedToTerms
    );
  };

  const handleContinue = () => {
    if (!isComplete()) {
      onError?.(['Please acknowledge all required items before continuing']);
      return;
    }

    const completedData = {
      ...educationData,
      completedAt: new Date().toISOString()
    };

    onComplete?.(completedData);
  };

  const renderEducationSection = (section: EducationSection) => {
    const IconComponent = section.icon;
    const isExpanded = expandedSections.has(section.id);
    const isRead = readSections.has(section.id);

    return (
      <div key={section.id} className="border border-sage/20 rounded-lg overflow-hidden">
        <motion.button
          onClick={() => toggleSection(section.id)}
          className="w-full p-4 text-left flex items-center justify-between hover:bg-sage/5 transition-colors"
          whileHover={{ backgroundColor: 'rgba(118, 169, 250, 0.05)' }}
        >
          <div className="flex items-center space-x-3">
            <div className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center',
              section.importance === 'high' && 'bg-red-500/20 text-red-400',
              section.importance === 'medium' && 'bg-yellow-500/20 text-yellow-400',
              section.importance === 'low' && 'bg-green-500/20 text-green-400'
            )}>
              <IconComponent className="w-5 h-5" />
            </div>
            
            <div>
              <h3 className="text-cream font-semibold flex items-center space-x-2">
                <span>{section.title}</span>
                {isRead && <CheckCircle className="w-4 h-4 text-green-400" />}
              </h3>
              <p className="text-sage/70 text-sm">{section.description}</p>
            </div>
          </div>

          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-sage/50"
          >
            ▼
          </motion.div>
        </motion.button>

        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <div className="p-4 bg-navy-dark/30 border-t border-sage/20">
                <ul className="space-y-2">
                  {section.content.map((item, index) => (
                    <motion.li
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-start space-x-2"
                    >
                      <CheckCircle className="w-4 h-4 text-teal-primary mt-0.5 flex-shrink-0" />
                      <span className="text-sage/90 text-sm">{item}</span>
                    </motion.li>
                  ))}
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderRequiredAcknowledgments = () => (
    <GlassMorphism variant="medium" className="p-6">
      <h3 className="text-lg font-semibold text-cream mb-4 flex items-center space-x-2">
        <Shield className="w-5 h-5 text-teal-primary" />
        <span>Required Acknowledgments</span>
      </h3>

      <div className="space-y-4">
        <label className="flex items-start space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={educationData.acknowledgedCompliance}
            onChange={(e) => handleCheckboxChange('acknowledgedCompliance', e.target.checked)}
            className="mt-1 w-4 h-4 text-teal-primary bg-transparent border-2 border-sage/30 rounded focus:ring-teal-primary focus:ring-2"
          />
          <div>
            <p className="text-cream font-medium">I understand the compliance requirements</p>
            <p className="text-sage/70 text-sm">I acknowledge that business verification is required by law and helps prevent fraud and money laundering.</p>
          </div>
        </label>

        <label className="flex items-start space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={educationData.readPrivacyPolicy}
            onChange={(e) => handleCheckboxChange('readPrivacyPolicy', e.target.checked)}
            className="mt-1 w-4 h-4 text-teal-primary bg-transparent border-2 border-sage/30 rounded focus:ring-teal-primary focus:ring-2"
          />
          <div>
            <p className="text-cream font-medium">I have read the Privacy Policy</p>
            <p className="text-sage/70 text-sm">
              I understand how my data is collected, used, and protected. 
              <a href="/privacy" target="_blank" className="text-teal-primary hover:text-teal-secondary ml-1">
                Read Privacy Policy <ExternalLink className="w-3 h-3 inline" />
              </a>
            </p>
          </div>
        </label>

        <label className="flex items-start space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={educationData.understoodProcess}
            onChange={(e) => handleCheckboxChange('understoodProcess', e.target.checked)}
            className="mt-1 w-4 h-4 text-teal-primary bg-transparent border-2 border-sage/30 rounded focus:ring-teal-primary focus:ring-2"
          />
          <div>
            <p className="text-cream font-medium">I understand the verification process</p>
            <p className="text-sage/70 text-sm">I have read about what documents are required and what to expect during verification.</p>
          </div>
        </label>

        <label className="flex items-start space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={educationData.agreedToTerms}
            onChange={(e) => handleCheckboxChange('agreedToTerms', e.target.checked)}
            className="mt-1 w-4 h-4 text-teal-primary bg-transparent border-2 border-sage/30 rounded focus:ring-teal-primary focus:ring-2"
          />
          <div>
            <p className="text-cream font-medium">I agree to the Terms of Service</p>
            <p className="text-sage/70 text-sm">
              I agree to abide by the platform's terms and conditions.
              <a href="/terms" target="_blank" className="text-teal-primary hover:text-teal-secondary ml-1">
                Read Terms <ExternalLink className="w-3 h-3 inline" />
              </a>
            </p>
          </div>
        </label>
      </div>

      <div className="mt-6 pt-6 border-t border-sage/20">
        <div className="flex items-center justify-between">
          <div className="text-sm text-sage/70">
            {Object.values(educationData).filter(Boolean).length - 1} of 4 items acknowledged
          </div>
          
          <motion.button
            onClick={handleContinue}
            disabled={!isComplete() || isLoading}
            className={cn(
              'px-8 py-3 font-medium rounded-lg transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-teal-primary/50',
              isComplete() && !isLoading
                ? 'bg-teal-primary hover:bg-teal-secondary text-cream'
                : 'bg-sage/20 text-sage/50 cursor-not-allowed'
            )}
            whileHover={isComplete() ? { scale: 1.02 } : {}}
            whileTap={isComplete() ? { scale: 0.98 } : {}}
          >
            {isLoading ? 'Processing...' : 'Begin Verification'}
          </motion.button>
        </div>
      </div>
    </GlassMorphism>
  );

  const renderFAQSection = () => (
    <AnimatePresence>
      {showFAQ && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3 }}
        >
          <GlassMorphism variant="subtle" className="p-6 mt-6">
            <h3 className="text-lg font-semibold text-cream mb-4 flex items-center space-x-2">
              <HelpCircle className="w-5 h-5 text-teal-primary" />
              <span>Frequently Asked Questions</span>
            </h3>

            <div className="space-y-4">
              {FAQS.map((faq, index) => (
                <div key={index} className="border-b border-sage/20 pb-4 last:border-b-0">
                  <h4 className="text-cream font-medium mb-2">{faq.question}</h4>
                  <p className="text-sage/70 text-sm">{faq.answer}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 text-center">
              <p className="text-sage/70 text-sm">
                Still have questions? 
                <a href="mailto:support@example.com" className="text-teal-primary hover:text-teal-secondary ml-1">
                  Contact our support team
                </a>
              </p>
            </div>
          </GlassMorphism>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="text-center">
        <div className="w-16 h-16 bg-teal-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <Shield className="w-8 h-8 text-teal-primary" />
        </div>
        <h2 className="text-2xl font-bold text-cream mb-2">Business Verification Overview</h2>
        <p className="text-sage/70">
          Learn about our verification process and requirements before you begin
        </p>
      </div>

      {/* Progress Indicator */}
      <div className="flex items-center justify-center space-x-2">
        {EDUCATION_SECTIONS.filter(s => s.importance === 'high').map((section, index) => (
          <div
            key={section.id}
            className={cn(
              'w-3 h-3 rounded-full transition-colors',
              readSections.has(section.id) ? 'bg-teal-primary' : 'bg-sage/30'
            )}
          />
        ))}
      </div>

      {/* Education Sections */}
      <div className="space-y-4">
        {EDUCATION_SECTIONS.map(section => renderEducationSection(section))}
      </div>

      {/* FAQ Toggle */}
      <div className="text-center">
        <motion.button
          onClick={() => setShowFAQ(!showFAQ)}
          className="text-teal-primary hover:text-teal-secondary transition-colors text-sm"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {showFAQ ? 'Hide' : 'Show'} Frequently Asked Questions
        </motion.button>
      </div>

      {/* FAQ Section */}
      {renderFAQSection()}

      {/* Required Acknowledgments */}
      {renderRequiredAcknowledgments()}

      {/* Security Notice */}
      <div className="flex items-start space-x-3 p-4 bg-teal-primary/10 border border-teal-primary/20 rounded-lg">
        <Lock className="w-5 h-5 text-teal-primary mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-teal-200 font-medium mb-1">Your Security is Our Priority</p>
          <p className="text-teal-100/80 text-sm">
            All information you provide is encrypted and securely stored. We are SOC 2 Type II certified 
            and compliant with all major data protection regulations including GDPR and CCPA.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ComplianceEducation;