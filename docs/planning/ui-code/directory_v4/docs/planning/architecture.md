Document 4: Fullstack Architecture Document

Date
Version
Description
Author
2025-07-31
Final
Final version of the Fullstack Architecture.
Winston, Architect


1. Introduction

This document outlines the complete fullstack architecture for The Lawless Directory. The project will be built using a starter template (e.g., T3 Stack, adapted for Supabase) as its foundation to accelerate setup and ensure best practices.

2. High Level Architecture


Technical Summary (Final Version)

Think of our project like building a modern, prefabricated retail space. We're using Vercel as the land and storefront, which is located everywhere at once so it's always fast for customers. We're using Supabase as our secure, all-in-one back office that handles inventory (our data), employee access (user accounts), and the cash register (payments).
Technically, this translates to a serverless, Jamstack-oriented architecture deployed on Vercel's edge network. The frontend is a Next.js application leveraging Server-Side Rendering (SSR) for maximum SEO performance. The backend is fully managed by Supabase, utilizing its Postgres database with Row Level Security (RLS), JWT-based authentication, and file storage. The entire project will be organized in a monorepo to streamline development and code sharing.
(This section also includes the detailed High Level Architecture Diagram, a breakdown of architectural patterns, a risk analysis with mitigation strategies, and a scalability analysis confirming the stack can handle the expected load.)

3. Tech Stack

(The definitive, version-pinned technology stack table is documented here for the development team.)

4. Data Models

(The final, refined data models for Directory, Business, Tag, Profile, and Subscription, including their TypeScript interfaces, are fully documented.)

5. API Specification

(The OpenAPI 3.0 specification for the Supabase REST API and custom serverless functions is documented here to serve as a contract for the frontend.)

6. Components

The application is broken down into three primary logical components:
Web Frontend (Next.js Application)
Supabase Services (BaaS Backend)
Stripe Integration (Serverless Function)

7. External APIs

Supabase API
Stripe API
Geocoding Service API (A provider like Google Maps or Mapbox will be chosen during implementation.)

8. Core Workflows & Database Schema

(This section contains the detailed sequence diagram for the Business Onboarding & Payment Flow and the complete PostgreSQL schema (DDL) with a plain-language summary.)

9. Frontend & Backend Architecture

(This section contains the detailed, refined blueprints for building the application, including component organization, state management strategy, routing patterns, data access layers, and authentication/authorization patterns, with code examples for each.)

10. Unified Project Structure

(The complete ASCII-tree directory structure for the Turborepo monorepo is documented here.)

11. Development & Deployment

(This section includes the step-by-step Development Workflow for local setup and the automated, Git-driven Deployment Architecture for Vercel.)

12. Security, Performance, Testing & Standards

(This section details our "defense-in-depth" security strategy, performance optimization goals (Lighthouse 90+), the "Testing Pyramid" strategy with examples, and the critical coding standards for the AI developer agents.)

13. Error Handling & Monitoring

(This section defines the unified strategies for error handling and application monitoring, including the use of an external error tracking service like Sentry.)
