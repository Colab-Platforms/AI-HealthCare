import React from "react";
import SEO from "../hooks/useSEO";
import UpdatedNavbar from "../components/landing/landing-components/UpdatedNavbar";
import UpdatedFooter from "../components/landing/landing-components/UpdatedFooter";
import PdfViewer from "../components/PdfViewer";

const PrivacyPolicy = () => {
  const pdfUrl =
    "https://res.cloudinary.com/dvgg1i1ck/image/upload/v1790069504/Privacy_Policy_fj5jtj.pdf"

  return (
    <div className="bg-landing-light-bg text-landing-text font-landing-body">
      <SEO pageName="privacyPolicy" />
      <UpdatedNavbar />
      <div className="">
        <div className="h-[350px] bg-landing-primary relative z-10 flex items-center justify-center text-center">
          <div className="container px-5 lg:px-20 mx-auto relative z-10 text-white mt-14">
            <h1 className="text-3xl lg:text-6xl text-white font-landing-accent-2 text-balance">
              Privacy Policy
            </h1>
            <p className="text-sm lg:text-base text-white mt-4">
              Your privacy is important to us. Please read our privacy policy
              carefully.
            </p>
          </div>
        </div>

        {/* Renders every page as canvas, same code path on desktop, Android
            and iOS — no iframe, no OS-native PDF viewer, no leaving the page. */}
        <div className="container mx-auto px-5 lg:px-20 mt-10">
          <PdfViewer url={pdfUrl} title="the Privacy Policy" />
        </div>

        <div className="container mx-auto px-5 lg:px-20 mt-4 flex w-full flex-wrap gap-3 mb-10">
          <a
            href={pdfUrl}
            download
            className="rounded-lg bg-slate-200 px-4 py-2.5 font-semibold text-slate-900 no-underline transition hover:bg-slate-300"
          >
            Download PDF
          </a>
        </div>

        {/* Visible, crawlable HTML mirror of the Privacy Policy PDF above,
            for search engine / OAuth verification indexing. Content is
            identical to the PDF. Uses the native <details> element so it
            renders as real, genuinely-visible text (not hidden via CSS),
            avoiding any cloaking concerns while keeping the default view
            uncluttered. */}
        <div className="container mx-auto px-5 lg:px-20 mt-4 mb-10">
          <details className="group rounded-lg border border-slate-200 bg-white p-5 lg:p-8">
            <summary className="cursor-pointer list-none text-lg font-semibold text-landing-text flex items-center justify-between">
              Read Full Privacy Policy
              <span className="ml-3 text-slate-400 transition-transform group-open:rotate-180">
                ▾
              </span>
            </summary>
            <article
              className="
                max-w-none mt-8 pt-8 border-t border-slate-200
                text-slate-700 leading-relaxed
                [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-landing-text [&_h2]:mt-0 [&_h2]:mb-6
                [&_h3]:text-xl [&_h3]:font-bold [&_h3]:text-landing-text [&_h3]:mt-12 [&_h3]:mb-4 [&_h3]:pb-2 [&_h3]:border-b [&_h3]:border-slate-200
                [&_h4]:text-base [&_h4]:font-semibold [&_h4]:text-landing-text [&_h4]:mt-8 [&_h4]:mb-3
                [&_p]:mb-4 [&_p]:text-[15px]
                [&_ul]:mb-5 [&_ul]:pl-5 [&_ul]:space-y-2 [&_ul]:list-disc
                [&_li]:text-[15px]
                [&_strong]:text-landing-text [&_strong]:font-semibold
                [&_table]:w-full [&_table]:mb-6 [&_table]:border-collapse [&_table]:text-sm [&_table]:overflow-hidden [&_table]:rounded-lg [&_table]:border [&_table]:border-slate-200
                [&_thead]:bg-landing-primary/10
                [&_th]:text-left [&_th]:font-semibold [&_th]:text-landing-text [&_th]:p-3 [&_th]:border [&_th]:border-slate-200
                [&_td]:p-3 [&_td]:border [&_td]:border-slate-200 [&_td]:align-top
                [&_tbody_tr:nth-child(even)]:bg-slate-50
              "
            >
              <h2>PRIVACY POLICY</h2>

              <p>
                Take.health is an AI-Enabled Preventive Healthcare Platform
                operated by TAKE Solutions Limited, a company incorporated
                under the Companies Act 2013 and listed on the National
                Stock Exchange (NSE) and Bombay Stock Exchange (BSE) of
                India (hereinafter referred to as &quot;TAKE
                Solutions&quot;, &quot;we&quot;, &quot;us&quot;, or
                &quot;our&quot;). Our registered office is in Chennai, Tamil
                Nadu, India.
              </p>

              <p>
                The take.health platform (accessible at www.take.health and
                via associated applications) offers AI-powered personalized
                health insights, lab report analysis, predictive risk
                identification, health dashboards, nutrition and diet
                management, sleep tracking, wellness monitoring, and related
                preventive healthcare services (collectively, the
                &quot;Platform&quot; or &quot;Services&quot;).
              </p>

              <p>
                In providing these Services, we collect, process, store, and
                use personal data, including sensitive health data,
                belonging to you (the &quot;Data Principal&quot; or
                &quot;User&quot;). We take this responsibility seriously.
                This Privacy Policy explains in plain, honest language
                exactly what we do with your data, why we do it, and what
                rights you have.
              </p>

              <h3>Definitions</h3>
              <p>
                For the purposes of this Privacy Policy, the following terms
                have the meanings assigned below. Capitalised terms used but
                not defined here shall bear the meaning ascribed to them
                under the DPDPA 2023 or the Information Technology Act, 2000
                (IT Act), as applicable.
              </p>

              <table>
                <thead>
                  <tr>
                    <th>Term</th>
                    <th>Meaning</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Personal Data</td>
                    <td>
                      Any data about an individual who is identifiable by or
                      in relation to such data, whether directly or
                      indirectly including name, contact details, health
                      records, biometric identifiers, and device
                      identifiers.
                    </td>
                  </tr>
                  <tr>
                    <td>Sensitive Personal Data or Information (SPDI)</td>
                    <td>
                      Categories of data defined under Rule 3 of the IT
                      (SPDI) Rules 2011, including passwords, financial
                      information, physical and mental health condition,
                      medical records and history, biometric information,
                      and sexual orientation. Your health data on this
                      Platform is SPDI.
                    </td>
                  </tr>
                  <tr>
                    <td>Data Fiduciary</td>
                    <td>
                      The entity (TAKE Solutions Limited) that determines
                      the purpose and means of processing personal data
                      i.e., the controller equivalent.
                    </td>
                  </tr>
                  <tr>
                    <td>Data Principal</td>
                    <td>
                      The individual whose personal data is being processed
                      i.e., you, the User of the Platform.
                    </td>
                  </tr>
                  <tr>
                    <td>Data Processor</td>
                    <td>
                      Any third party that processes personal data on behalf
                      of the Data Fiduciary pursuant to a written contract.
                    </td>
                  </tr>
                  <tr>
                    <td>Processing</td>
                    <td>
                      Any operation performed on personal data collection,
                      storage, use, disclosure, deletion, or destruction.
                    </td>
                  </tr>
                  <tr>
                    <td>Consent</td>
                    <td>
                      Free, specific, informed, unconditional, and
                      unambiguous indication of the Data Principal&apos;s
                      wishes, given by a clear affirmative action, for
                      processing of personal data for a specified purpose.
                    </td>
                  </tr>
                  <tr>
                    <td>AI-Generated Health Insights</td>
                    <td>
                      Predictions, risk scores, wellness recommendations,
                      and health assessments generated by the Platform&apos;s
                      artificial intelligence and machine learning models.
                    </td>
                  </tr>
                  <tr>
                    <td>Health Data</td>
                    <td>
                      All data pertaining to your physical and mental health
                      condition, medical history, lab reports, biometric
                      measurements, nutritional intake, sleep patterns, and
                      wellness indicators that you submit to or that is
                      generated by the Platform.
                    </td>
                  </tr>
                  <tr>
                    <td>Platform</td>
                    <td>
                      The take.health website (www.take.health), user
                      dashboard (/dashboard), associated mobile
                      applications, and all related services offered by
                      TAKE Solutions.
                    </td>
                  </tr>
                </tbody>
              </table>

              <h3>What Personal Data We Collect</h3>
              <p>
                We collect only the data that is necessary for the purposes
                described in this Policy. Below is a complete and
                transparent account of the categories of data we collect,
                with an indication of whether each category constitutes
                SPDI under Indian law.
              </p>

              <p>
                When you register on the Platform, we collect the following
                information to create and manage your account:
              </p>
              <ul>
                <li>Full name</li>
                <li>Email address</li>
                <li>Mobile number</li>
                <li>Date of birth and age</li>
                <li>Gender</li>
                <li>Profile photograph (if voluntarily provided)</li>
                <li>
                  Login credentials (passwords are stored only in a hashed
                  and salted form we cannot see your plaintext password)
                </li>
              </ul>

              <h4>Health and Medical Data [SPDI]</h4>
              <ul>
                <li>
                  Uploaded lab reports and pathology results (blood tests,
                  urine analysis, imaging reports, etc.)
                </li>
                <li>
                  Medical history chronic conditions, past diagnoses,
                  surgeries, hospitalizations
                </li>
                <li>Current medications, dosage, and treatment regimens</li>
                <li>
                  Physical measurements height, weight, BMI, blood pressure,
                  blood glucose, heart rate, SpO2
                </li>
                <li>
                  Biometric data collected via integrated health devices or
                  wearables
                </li>
                <li>
                  Mental health indicators stress levels, mood tracking,
                  anxiety and depression self-assessments
                </li>
                <li>Sleep patterns and quality data</li>
                <li>Nutritional intake logs and dietary information</li>
                <li>
                  Family medical history and genetic risk indicators (where
                  voluntarily provided)
                </li>
                <li>
                  Preventive health risk scores generated by AI analysis of
                  the above
                </li>
              </ul>

              <p>
                When you access and use the Platform, we automatically
                collect certain technical data to ensure the Platform
                functions correctly and to improve our Services:
              </p>
              <ul>
                <li>
                  IP address and approximate geographic location
                  (city/state level)
                </li>
                <li>Device type, operating system, and browser version</li>
                <li>
                  Pages visited, features used, and time spent on the
                  Platform
                </li>
                <li>Referring website or source of access</li>
                <li>Session identifiers and access timestamps</li>
                <li>Error logs and crash reports</li>
              </ul>

              <p>
                If you contact us via email, chat, support ticket, or
                through the Platform&apos;s communication features, we
                collect and retain:
              </p>
              <ul>
                <li>The content of your communication</li>
                <li>Your contact information as provided</li>
                <li>Records of correspondence and support interactions</li>
                <li>Feedback, survey responses, and ratings</li>
              </ul>

              <p>
                If you access the Platform as a Registered Medical
                Practitioner, healthcare facility, diagnostic laboratory, or
                corporate wellness provider, we additionally collect:
              </p>
              <ul>
                <li>
                  Medical Council registration number (mandatory under
                  Telemedicine Guidelines 2020)
                </li>
                <li>Professional qualifications and specialization</li>
                <li>Institutional affiliation</li>
                <li>
                  Patient data processed on your behalf (governed by a
                  separate Data Processing Agreement)
                </li>
              </ul>

              <h3>Data We Do Not Collect</h3>
              <p>
                We do not collect the following categories of data, and we
                will never solicit them from you:
              </p>
              <ul>
                <li>
                  We do not directly collect or store financial information
                  such as bank account details or credit/debit card
                  numbers. Payments, if enabled, are processed through
                  secure and compliant third-party payment gateways, and we
                  receive only limited transaction confirmation details.
                </li>
                <li>
                  Any data from minors under the age of 18 without verified
                  parental consent.
                </li>
              </ul>

              <h3>How We Collect Your Data</h3>
              <p>
                We collect data through the following methods, each of
                which is clearly identified to you at the point of
                collection:
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Collection Method</th>
                    <th>Examples / Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Direct submission by you</td>
                    <td>
                      Registration forms, health assessment questionnaires,
                      lab report uploads, profile updates, nutrition logs,
                      sleep tracking entries, manual health parameter
                      inputs.
                    </td>
                  </tr>
                  <tr>
                    <td>Automated collection during Platform use</td>
                    <td>
                      Server logs, cookies (strictly necessary only, unless
                      consented to), session data, error tracking. See
                      Section 14 for details.
                    </td>
                  </tr>
                  <tr>
                    <td>Integration with health devices or wearables</td>
                    <td>
                      Data synced from third-party fitness trackers,
                      smartwatches, or medical devices only with your
                      explicit authorization of the integration.
                    </td>
                  </tr>
                  <tr>
                    <td>Healthcare Provider input</td>
                    <td>
                      Data entered by your Registered Medical Practitioner
                      on the Platform with your consent, including clinical
                      notes, prescriptions, and test results.
                    </td>
                  </tr>
                  <tr>
                    <td>Third-party diagnostic labs</td>
                    <td>
                      Lab report data shared electronically by partner
                      diagnostic laboratories only where you have explicitly
                      authorized such sharing.
                    </td>
                  </tr>
                </tbody>
              </table>

              <h3>Purpose and Legal Basis for Processing</h3>
              <p>
                Under the DPDPA 2023 (Section 4 read with Sections 6 and 7),
                we may only process your personal data for a specified,
                clear, and lawful purpose. Below is a comprehensive table of
                the purposes for which we process your data, the specific
                data categories involved, and the legal basis for each
                processing activity.
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Purpose</th>
                    <th>Data Involved</th>
                    <th>Legal Basis (DPDPA 2023)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Account creation and identity verification</td>
                    <td>Name, email, mobile, date of birth, gender</td>
                    <td>Section 7(a) Consent; Contract performance</td>
                  </tr>
                  <tr>
                    <td>
                      Delivering AI-powered health insights and risk
                      predictions
                    </td>
                    <td>
                      Health data, lab reports, medical history, biometric
                      data [SPDI]
                    </td>
                    <td>
                      Section 6 Explicit, granular consent for SPDI
                      processing
                    </td>
                  </tr>
                  <tr>
                    <td>Lab report analysis and interpretation</td>
                    <td>Uploaded lab reports, medical records [SPDI]</td>
                    <td>Section 6 Explicit consent</td>
                  </tr>
                  <tr>
                    <td>Personalized nutrition and diet recommendations</td>
                    <td>Dietary intake, BMI, metabolic data [SPDI]</td>
                    <td>Section 6 Explicit consent</td>
                  </tr>
                  <tr>
                    <td>Sleep quality monitoring and wellness tracking</td>
                    <td>Sleep data, lifestyle indicators [SPDI]</td>
                    <td>Section 6 Explicit consent</td>
                  </tr>
                  <tr>
                    <td>Predictive health risk identification</td>
                    <td>Longitudinal health data, family history [SPDI]</td>
                    <td>Section 6 Explicit consent</td>
                  </tr>
                  <tr>
                    <td>
                      Facilitating doctor-patient communication
                      (telemedicine)
                    </td>
                    <td>Health records, consultation data [SPDI]</td>
                    <td>
                      Section 6 Explicit consent; Telemedicine Guidelines
                      2020
                    </td>
                  </tr>
                  <tr>
                    <td>
                      Sending health-related notifications and reminders
                    </td>
                    <td>Email, mobile number, health events</td>
                    <td>Section 6 Consent (opt-in)</td>
                  </tr>
                  <tr>
                    <td>Customer support and grievance resolution</td>
                    <td>Communications data, account data</td>
                    <td>
                      Section 7(c) Legitimate interests / contractual
                      obligation
                    </td>
                  </tr>
                  <tr>
                    <td>Platform security and fraud prevention</td>
                    <td>Technical data, IP address, device data</td>
                    <td>Section 7(d) Legal obligation under IT Act 2000</td>
                  </tr>
                  <tr>
                    <td>Compliance with legal obligations</td>
                    <td>Relevant personal data as required</td>
                    <td>Section 7(d) Legal obligation</td>
                  </tr>
                  <tr>
                    <td>
                      Improving AI models and Platform features (anonymized
                      or with consent)
                    </td>
                    <td>
                      Aggregated, de-identified health data only, OR
                      personal data with explicit separate consent
                    </td>
                    <td>
                      Section 6 Explicit, separate consent (NOT bundled with
                      service consent)
                    </td>
                  </tr>
                  <tr>
                    <td>
                      Sending promotional and marketing communications
                      (Platform services only)
                    </td>
                    <td>Email, mobile number</td>
                    <td>
                      Section 6 Consent (separate, opt-in only; easily
                      withdrawable)
                    </td>
                  </tr>
                </tbody>
              </table>

              <h3>AI-Powered Processing and Automated Decision-Making</h3>
              <p>
                A core feature of the take.health Platform is the use of
                artificial intelligence and machine learning to analyze your
                health data and generate personalized preventive health
                insights. This section explains how AI operates on the
                Platform and your rights in relation to it.
              </p>

              <h4>How AI is Used on the Platform</h4>
              <ul>
                <li>
                  Analyzing uploaded lab reports to identify parameters
                  outside normal reference ranges and highlight patterns
                  that may warrant attention
                </li>
                <li>
                  Generating predictive health risk scores for conditions
                  such as hypertension, diabetes, metabolic syndrome, and
                  cardiac risk, based on your longitudinal health data
                </li>
                <li>
                  Providing personalized nutrition, lifestyle, and wellness
                  recommendations tailored to your health profile
                </li>
                <li>
                  Monitoring trends in your health data over time and
                  alerting you to significant changes
                </li>
                <li>
                  Assisting Registered Medical Practitioners with clinical
                  decision support tools (AI assists; only the RMP makes
                  clinical decisions)
                </li>
              </ul>

              <h4>AI Cannot Replace Clinical Judgment</h4>
              <p>
                All AI-generated health insights, risk scores, and wellness
                recommendations produced by the Platform are tools for
                informational and preventive awareness purposes only. They
                do not constitute a medical diagnosis, clinical assessment,
                or prescription. The Platform&apos;s AI systems are not a
                substitute for consultation with a licensed Registered
                Medical Practitioner (RMP). In accordance with the
                Telemedicine Practice Guidelines 2020 issued by the Board of
                Governors of the Medical Council of India, AI and machine
                learning platforms are expressly prohibited from
                counselling patients or prescribing medicines. Only a
                qualified RMP can provide clinical advice and treatment. If
                you have any health concern, you must consult a qualified
                healthcare professional. Do not delay seeking medical
                attention or disregard professional medical advice on the
                basis of AI-generated content from this Platform.
              </p>

              <h4>Transparency About AI Models</h4>
              <p>
                In compliance with the DPDPA 2023 (Section 5 Transparency)
                and MeitY&apos;s AI Advisory (March 2023) on responsible AI
                deployment for consequential use cases, we disclose the
                following:
              </p>
              <ul>
                <li>
                  The Platform uses AI and machine learning models,
                  including third-party AI application programming
                  interfaces (APIs), to generate health insights
                </li>
                <li>
                  AI models used on the Platform are regularly validated for
                  accuracy and clinical relevance; however, no AI model
                  achieves perfect accuracy, and all outputs carry an
                  inherent margin of error
                </li>
                <li>
                  AI health predictions are based on population-level data
                  patterns and may not account for rare conditions,
                  individual genetic variations, or clinical context that a
                  doctor would consider
                </li>
                <li>
                  Where the Platform uses third-party AI providers, such
                  providers are bound by Data Processing Agreements that
                  prohibit them from using your data for any purpose other
                  than generating the health insights you have requested
                </li>
                <li>
                  We do not use your personal health data to train or
                  improve AI models without obtaining a separate, explicit,
                  and informed consent that is clearly distinct from your
                  service access consent
                </li>
              </ul>

              <h4>No Medical Advice and No Doctor-Patient Relationship</h4>
              <ul>
                <li>
                  The Platform, including all AI-generated insights,
                  reports, recommendations, and content, is provided
                  strictly for informational, educational, and preventive
                  healthcare purposes only. Nothing on the Platform
                  constitutes medical advice, diagnosis, treatment, or
                  prescription.
                </li>
                <li>
                  Use of the Platform does not create a doctor-patient
                  relationship between you and TAKE Solutions Limited, or
                  between you and any healthcare provider unless a formal
                  consultation is expressly undertaken through authorized
                  channels.
                </li>
                <li>
                  You acknowledge that all health-related decisions must be
                  made in consultation with a qualified Registered Medical
                  Practitioner. Reliance on any information provided by the
                  Platform is solely at your own risk.
                </li>
              </ul>

              <h3>How We Share Your Data</h3>
              <p>
                We treat your data with strict confidentiality. We do not
                sell, rent, or trade your personal data and especially not
                your health data to any third party for commercial or
                advertising purposes. This is an absolute commitment. We
                share your data only in the limited circumstances described
                below.
              </p>

              <h4>Sharing with Healthcare Providers (With Your Consent)</h4>
              <p>
                If you use the Platform to consult with, or share your
                health information with, a Registered Medical Practitioner,
                diagnostic laboratory, or healthcare facility available
                through the Platform, your health data will be shared with
                that provider solely to enable the healthcare service you
                have requested. This sharing occurs only upon your
                explicit, case-by-case consent. Healthcare providers
                accessing your data through the Platform are required to
                comply with all applicable medical ethics obligations, the
                Telemedicine Practice Guidelines 2020, and data protection
                obligations.
              </p>

              <h4>Sharing with Data Processors (Service Providers)</h4>
              <p>
                We engage certain trusted third-party service providers
                (Data Processors) to assist in operating the Platform. These
                include cloud hosting and infrastructure providers, payment
                gateway operators (who receive only tokenized transaction
                data not your health data), AI and analytics platform
                providers, and customer support and communication tools.
                All Data Processors are bound by written contracts that:
                (a) restrict them to processing your data only on our
                documented instructions; (b) prohibit independent use of
                your data; (c) require implementation of appropriate
                security safeguards; and (d) mandate deletion of your data
                upon termination of the service relationship. Data
                Processors are required to comply with the DPDPA 2023 in
                their capacity as Data Processors.
              </p>

              <h4>Health and Wearable Integration Providers</h4>
              <p>
                Where you choose to connect a third-party health or
                wearable platform, Take.health may receive data from that
                platform in accordance with the permissions you authorize.
                Such data is used to provide the health, fitness, wellness,
                dashboard, tracking and recommendation features described
                in this Policy. We do not sell wearable or health-platform
                data or use it for targeted advertising.
              </p>

              <h4>Sharing Under Legal Obligation</h4>
              <p>
                We may disclose your personal data to competent
                governmental authorities, regulatory bodies, law
                enforcement agencies, or courts when we are required to do
                so by applicable law, a valid court order, regulatory
                direction, or to protect the rights, property, or safety of
                TAKE Solutions, our users, or the public. We will, where
                legally permissible, notify you of such a disclosure.
              </p>

              <h4>Sharing in the Context of Corporate Transactions</h4>
              <p>
                In the event of a merger, acquisition, sale of substantially
                all assets, restructuring, or any similar corporate
                transaction involving TAKE Solutions Limited, your personal
                data may be disclosed to the prospective acquirer or
                successor entity. We will ensure that the receiving entity
                provides equivalent or superior data protection
                commitments. You will be notified of any such change in
                Data Fiduciary.
              </p>

              <h4>Aggregated and Anonymized Data</h4>
              <p>
                We may share aggregated, de-identified, and anonymized data
                (from which it is not possible to identify any individual)
                for research, public health purposes, industry
                benchmarking, and reporting. Such data does not constitute
                personal data under the DPDPA 2023.
              </p>

              <h4>User Responsibility</h4>
              <p>
                You are responsible for ensuring that all information,
                health data, and records submitted by you on the Platform
                are accurate, complete, and up to date. The accuracy of
                AI-generated insights is dependent on the quality and
                completeness of the data provided by you. TAKE Solutions
                shall not be responsible for any incorrect outputs arising
                from inaccurate or incomplete information submitted by the
                User.
              </p>

              <h3>Health and Fitness Data [Sensitive/Health Data]</h3>
              <p>
                Depending on the features you use and the permissions you
                grant, Take.health may collect or receive the following
                health and fitness information:
              </p>
              <ul>
                <li>Heart rate and resting heart rate (RHR)</li>
                <li>Heart rate variability (HRV)</li>
                <li>
                  Sleep duration and sleep-stage information, including deep
                  sleep, light sleep, REM sleep and awake time
                </li>
                <li>Physical activity, steps, workouts and exercise information</li>
                <li>Calories burned and activity intensity</li>
                <li>Recovery or readiness indicators</li>
                <li>Blood glucose</li>
                <li>Blood pressure</li>
                <li>Blood oxygen / SpO2</li>
                <li>Height, weight and BMI</li>
                <li>Nutrition, meals and dietary intake information</li>
                <li>Health and wellness scores generated by the Platform</li>
                <li>
                  Health and fitness information received from connected
                  wearables, smartwatches, health devices or health
                  platforms
                </li>
              </ul>

              <h4>Google Health Connect</h4>
              <p>
                Take.health may integrate with Google Health Connect to
                access health and fitness information that you authorize.
                Depending on the permissions granted by you, this may
                include activity, steps, exercise, heart rate, resting
                heart rate, heart rate variability, sleep, body
                measurements, nutrition, blood glucose, blood pressure,
                blood oxygen and other supported health metrics.
              </p>
              <p>
                Take.health uses this information to provide health
                tracking, Health Score, Sleep Score, Activity Score,
                Recovery Score, health trends, personalized recommendations
                and other features requested by you.
              </p>
              <p>
                Take.health accesses only the data types for which you
                provide permission. You may revoke access through your
                device or Health Connect settings at any time.
              </p>
              <p>
                Disconnecting Health Connect stops future synchronization.
                Previously imported data will be handled in accordance with
                the data deletion and retention provisions of this Privacy
                Policy.
              </p>

              <h4>Feature-Specific Use of Health Data</h4>
              <p>
                The following table explains how key Take.health features
                use the categories of health information described in this
                Policy.
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Feature</th>
                    <th>Data Used</th>
                    <th>Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Health Score</td>
                    <td>Sleep, Nutrition, Activity and Recovery data</td>
                    <td>Calculate and display the overall Health Score</td>
                  </tr>
                  <tr>
                    <td>Sleep Score</td>
                    <td>
                      Sleep duration, sleep stages, RHR and related sleep
                      metrics
                    </td>
                    <td>Calculate and display Sleep Score and sleep trends</td>
                  </tr>
                  <tr>
                    <td>Recovery Score</td>
                    <td>HRV, RHR, sleep and activity data</td>
                    <td>
                      Calculate and display Recovery Score and recovery
                      trends
                    </td>
                  </tr>
                  <tr>
                    <td>Activity / Fitness</td>
                    <td>
                      Steps, workouts, exercise, calories and activity data
                    </td>
                    <td>Track physical activity and fitness</td>
                  </tr>
                  <tr>
                    <td>Nutrition</td>
                    <td>
                      Meals, dietary intake, nutrition and body measurements
                    </td>
                    <td>
                      Track nutrition and provide personalized
                      recommendations
                    </td>
                  </tr>
                  <tr>
                    <td>Lab Reports</td>
                    <td>Uploaded laboratory reports and health parameters</td>
                    <td>Analyze reports and provide health insights</td>
                  </tr>
                  <tr>
                    <td>Health Trends</td>
                    <td>Historical health and biometric data</td>
                    <td>Identify and display changes and trends over time</td>
                  </tr>
                  <tr>
                    <td>AI Insights</td>
                    <td>
                      Health, nutrition, sleep, activity and medical data
                    </td>
                    <td>
                      Generate personalized preventive health insights
                    </td>
                  </tr>
                </tbody>
              </table>

              <h4>Wearable and Health Device Integrations</h4>
              <p>
                Where you choose to connect a compatible wearable,
                smartwatch, fitness tracker, medical device or health
                platform, Take.health may receive the health and fitness
                information that you authorize the connected service to
                share.
              </p>
              <p>
                Depending on the device and permissions granted, this may
                include heart rate, resting heart rate, HRV, sleep data,
                activity, steps, workouts, calories, SpO2, body
                measurements and recovery-related metrics.
              </p>
              <p>
                This information is used to provide health tracking, Health
                Score, Sleep Score, Activity Score, Recovery Score, health
                trends and personalized recommendations.
              </p>
              <p>
                Take.health does not sell health or wearable data or use
                such data for targeted advertising.
              </p>

              <h4>Data Used for AI Processing</h4>
              <p>
                Depending on the feature used, AI processing may involve
                information such as laboratory results, medical history,
                medications, health measurements, sleep data, activity
                data, nutrition information, wearable data and other
                information provided by you or collected through authorized
                integrations.
              </p>
              <p>
                AI processing is performed to provide the specific health
                analysis, recommendations, trends, scores or preventive
                insights requested through the Platform.
              </p>
              <p>
                Where third-party AI service providers are used, they
                process information only as necessary to provide the
                requested service and are subject to applicable contractual
                data-protection obligations.
              </p>

              <h4>Analytics and Technical Services</h4>
              <p>
                We may use analytics, application performance monitoring,
                crash reporting and similar technical services to
                understand how the Platform is used, diagnose technical
                issues, improve performance and maintain security.
              </p>
              <p>
                Such services may process information including device
                information, operating system, application version, IP
                address, session information, usage events, crash
                information and other technical information necessary for
                these purposes.
              </p>
              <p>
                Where third-party service providers are used, they process
                such information on our behalf and are subject to
                applicable contractual and data-protection requirements.
              </p>

              <h3>Account and Data Deletion</h3>
              <p>
                You may request deletion of your Take.health account and
                personal data through the account settings or by contacting
                us using the contact details provided in this Privacy
                Policy.
              </p>
              <p>
                Upon receiving and verifying a deletion request, we will
                delete applicable personal data from our active systems
                within the applicable period stated in the Data Retention
                and Deletion section, except where retention is required by
                applicable law, regulatory requirements, security
                investigations or legal proceedings.
              </p>
              <p>
                Deletion of your account may result in the permanent
                deletion of your health records, laboratory reports, health
                trends, recommendations and other information associated
                with your account.
              </p>

              <h3>Third-Party Technology and Service Providers</h3>
              <p>
                Take.health may use third-party service providers to
                provide infrastructure, analytics, AI processing,
                communications, payments, security and health-data
                integrations. The final published version of this Policy
                should be kept synchronized with the providers and SDKs
                actually enabled in the Platform.
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Service / Category</th>
                    <th>Purpose</th>
                    <th>Potential Data Processed</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Google Health Connect</td>
                    <td>Authorized health and fitness data integration</td>
                    <td>
                      Health and fitness data for which you grant permission
                    </td>
                  </tr>
                  <tr>
                    <td>AI service providers</td>
                    <td>
                      AI-powered health analysis and recommendations
                    </td>
                    <td>
                      Only information required for the requested AI feature
                    </td>
                  </tr>
                  <tr>
                    <td>Analytics providers</td>
                    <td>Product analytics and service improvement</td>
                    <td>Usage, device and technical information</td>
                  </tr>
                  <tr>
                    <td>Crash / performance monitoring providers</td>
                    <td>
                      Identify and resolve application errors and
                      performance issues
                    </td>
                    <td>Crash, device and diagnostic information</td>
                  </tr>
                  <tr>
                    <td>Cloud infrastructure providers</td>
                    <td>Hosting, storage and application infrastructure</td>
                    <td>Data stored or processed by Take.health</td>
                  </tr>
                  <tr>
                    <td>Communication providers</td>
                    <td>Email, notifications and customer support</td>
                    <td>Contact and communication information</td>
                  </tr>
                  <tr>
                    <td>Payment providers</td>
                    <td>Payment processing where enabled</td>
                    <td>
                      Limited transaction/payment confirmation information
                    </td>
                  </tr>
                </tbody>
              </table>

              <h3>Data Retention and Deletion</h3>
              <p>
                The retention periods below are the final applicable
                periods for each category of data. Where a legal,
                regulatory, security or medico-legal retention requirement
                applies, that requirement will take precedence.
              </p>
              <p>
                We retain your personal data only for as long as is
                necessary for the purposes described in this Policy, or as
                required by applicable law. The following retention
                schedule applies:
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Data Category</th>
                    <th>Retention Period</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Account and identity data</td>
                    <td>
                      Duration of active account. Following a verified
                      deletion request or account closure, personal data
                      will be deleted from active systems within 30
                      business days, unless retention is required by
                      applicable law.
                    </td>
                  </tr>
                  <tr>
                    <td>Health records and medical data [SPDI]</td>
                    <td>
                      Retained for the period required under applicable law
                      and applicable medical/medico-legal record-retention
                      requirements. Where no mandatory retention requirement
                      applies, data will be deleted from active systems
                      within 30 business days of a verified deletion
                      request.
                    </td>
                  </tr>
                  <tr>
                    <td>AI-generated health insights and reports</td>
                    <td>
                      Duration of active account. Following a verified
                      deletion request, personal data forming part of such
                      insights and reports will be deleted from active
                      systems within 30 business days, subject to
                      applicable legal retention requirements.
                    </td>
                  </tr>
                  <tr>
                    <td>Lab reports and uploaded documents</td>
                    <td>
                      Duration of active account. Following a verified
                      deletion request, lab reports and uploaded documents
                      will be deleted from active systems within 30 business
                      days, subject to minimum legal retention obligations.
                    </td>
                  </tr>
                  <tr>
                    <td>Usage and technical data (logs)</td>
                    <td>
                      30 days from the date of generation, unless required
                      for security investigations or legal proceedings.
                      Where deletion is requested earlier, the applicable
                      data will be deleted from active systems within 30
                      business days, subject to legal/security requirements.
                    </td>
                  </tr>
                  <tr>
                    <td>Wearable and health-platform data</td>
                    <td>
                      Retained while your account is active and the data is
                      required to provide the features you have requested.
                      Disconnecting an integration stops future
                      synchronization but does not automatically delete
                      previously imported data. Previously imported data is
                      deleted in accordance with the applicable deletion
                      request and retention requirements described in this
                      Policy.
                    </td>
                  </tr>
                  <tr>
                    <td>Communications and support records</td>
                    <td>
                      3 years from the date of the communication or
                      resolution of the matter.
                    </td>
                  </tr>
                  <tr>
                    <td>Consent records</td>
                    <td>
                      Duration of the processing activity for which consent
                      was obtained plus 5 years, as evidence of compliance.
                    </td>
                  </tr>
                  <tr>
                    <td>Transaction records (payment)</td>
                    <td>
                      8 years, as required under the Income Tax Act 1961 and
                      Companies Act 2013.
                    </td>
                  </tr>
                </tbody>
              </table>
              <p>
                Upon expiry of the applicable retention period, personal
                data will be securely destroyed using industry-standard
                methods (cryptographic erasure for cloud-stored data;
                physical destruction for any physical media). You have the
                right to request deletion of your data before the end of
                the retention period, subject to our minimum legal
                obligations.
              </p>

              <h3>Withdrawal of Consent</h3>
              <p>
                You may withdraw your consent to the processing of your
                personal data at any time by accessing your account
                settings or by contacting us at the details provided in
                this Policy.
              </p>
              <p>
                Upon withdrawal of consent, we will cease processing your
                personal data for the relevant purposes, unless retention
                or processing is required under applicable law. Withdrawal
                of consent may result in limited or discontinued access to
                certain features of the Platform.
              </p>

              <h3>Data Security</h3>
              <p>
                We implement appropriate technical and organizational
                measures to protect your personal data against unauthorized
                access, disclosure, alteration, loss, or destruction. Our
                security measures include, but are not limited to:
              </p>
              <ul>
                <li>
                  End-to-end encryption for all health data in transit (TLS
                  1.2 or higher) and at rest (AES-256 encryption)
                </li>
                <li>
                  Role-based access controls limiting staff access to
                  personal data on a strict need-to-know basis
                </li>
                <li>
                  Regular penetration testing and vulnerability assessments
                  by independent security auditors
                </li>
                <li>
                  Secure coding practices and regular code security reviews
                </li>
                <li>
                  Anonymization and pseudonymisation of health data in
                  development and testing environments
                </li>
                <li>
                  Data protection training for all employees who handle
                  personal data
                </li>
                <li>
                  Strict contractual data protection obligations imposed on
                  all Data Processors and vendors
                </li>
                <li>
                  A documented Information Security Policy reviewed
                  annually
                </li>
                <li>
                  A designated Data Protection Officer (DPO), whose details
                  are published in Section 19 of this Policy
                </li>
                <li>
                  Incident response procedures aligned with CERT-In
                  Directions 2022 (6-hour reporting for cyber incidents) and
                  DPDPA 2023 Rule 7 (Data Protection Board notification
                  timelines)
                </li>
              </ul>

              <h3>Cross-Border Data Transfers</h3>
              <p>
                Your personal data may be transferred to and processed in
                jurisdictions outside India where our servers or service
                providers are located.
              </p>
              <p>
                We ensure that such transfers are conducted in compliance
                with applicable laws and that appropriate safeguards are
                implemented to protect your personal data, including
                contractual obligations and security measures equivalent to
                those required under Indian law.
              </p>

              <h3>Data Breach Notification</h3>
              <p>
                In the event of a personal data breach that is likely to
                result in a risk to your rights and freedoms, we will:
              </p>
              <ul>
                <li>
                  Notify the Data Protection Board of India within the
                  timeline prescribed under DPDPA 2023 Rule 7 and CERT-In
                  Directions 2022 (which require reporting of cybersecurity
                  incidents within 6 hours of detection)
                </li>
                <li>
                  Notify all affected Data Principals without undue delay,
                  providing: a description of the nature of the breach; the
                  categories and approximate number of individuals
                  affected; the personal data records compromised; the
                  likely consequences of the breach; and the measures taken
                  or proposed to address the breach
                </li>
                <li>
                  Maintain a complete and accurate internal record of all
                  data breaches, including those not required to be
                  notified externally, in accordance with Section 8(6) of
                  the DPDPA 2023
                </li>
              </ul>
              <p>
                Breach notifications to affected users will be sent to the
                primary email address registered on your account. We
                strongly encourage you to keep your contact details
                current. To report a suspected data breach or security
                vulnerability, please contact us immediately at:{" "}
                support@takesolutions.com.
              </p>

              <h3>Children&apos;s Privacy</h3>
              <p>
                The take.health Platform is not directed at individuals
                under the age of 18 years. We do not knowingly collect
                personal data from minors without verifiable parental or
                guardian consent.
              </p>
              <p>
                Under the DPDPA 2023 (Section 9), special obligations apply
                to the processing of personal data of children.
                Specifically:
              </p>
              <ul>
                <li>
                  Before processing a child&apos;s data, we are required to
                  obtain verifiable consent from the child&apos;s parent or
                  lawful guardian
                </li>
                <li>
                  We are prohibited from processing children&apos;s data in
                  a manner that is detrimental to the child&apos;s wellbeing
                </li>
                <li>
                  We do not undertake behavioral tracking or targeted
                  advertising directed at children
                </li>
              </ul>
              <p>
                If we become aware that a child under the age of 18 has
                registered on the Platform without verifiable parental
                consent, we will immediately deactivate the account and
                delete all associated data. If you believe a minor has
                provided data to us without appropriate consent, please
                contact us at support@takesolutions.com immediately.
              </p>

              <h3>Changes to This Privacy Policy</h3>
              <p>
                We may update this Privacy Policy from time to time to
                reflect changes in law, technology, our business practices,
                or regulatory requirements. When we make material changes,
                we will:
              </p>
              <ul>
                <li>
                  Notify you by email to your registered address at least
                  15 days before the changes take effect
                </li>
                <li>Display a prominent notice on the Platform</li>
                <li>
                  Update the &quot;Last Reviewed&quot; date at the top of
                  this Policy
                </li>
                <li>
                  Obtain fresh consent where any material change involves a
                  new processing purpose or new category of sensitive data
                </li>
              </ul>
              <p>
                We encourage you to review this Policy periodically.
                Continued use of the Platform after the effective date of a
                revised Policy where you have been notified and provided
                the opportunity to review it constitutes your acceptance of
                the revised terms. If you do not agree with a material
                change, you may close your account and request deletion of
                your data before the effective date.
              </p>
              <p>
                <strong>Data Safety and Platform Consistency:</strong> The
                data categories, purposes, third-party services,
                permissions and deletion practices described in this
                Privacy Policy are intended to correspond with the
                information disclosed in the Platform&apos;s Google Play
                Data Safety declarations, Health Apps declarations,
                permission disclosures and in-app privacy notices.
              </p>

              <h3>Governing Law and Jurisdiction</h3>
              <p>
                This Privacy Policy is governed by the laws of India. Any
                dispute arising from or relating to this Policy or the
                processing of your personal data shall be subject to the
                exclusive jurisdiction of the courts at Chennai, Tamil
                Nadu, India, without prejudice to your rights to approach
                the Data Protection Board of India or any other competent
                regulatory authority.
              </p>
              <p>
                The following Indian laws and regulations, as amended from
                time to time, govern data processing under this Platform:
              </p>
              <ul>
                <li>
                  Digital Personal Data Protection Act, 2023 (DPDPA 2023)
                  and the Digital Personal Data Protection Rules, 2025
                </li>
                <li>
                  Information Technology Act, 2000 (IT Act) and the IT
                  (Reasonable Security Practices and Procedures and
                  Sensitive Personal Data or Information) Rules, 2011
                </li>
                <li>
                  IT (Intermediary Guidelines and Digital Media Ethics
                  Code) Rules, 2021
                </li>
                <li>
                  Telemedicine Practice Guidelines, 2020 (Board of
                  Governors, MCI / NMC)
                </li>
                <li>
                  Consumer Protection Act, 2019 and the Consumer Protection
                  (E-Commerce) Rules, 2020
                </li>
                <li>
                  Indian Medical Council (Professional Conduct, Etiquette
                  and Ethics) Regulations, 2002
                </li>
              </ul>
            </article>
          </details>
        </div>
      </div>
      <UpdatedFooter />
    </div>
  );
};

export default PrivacyPolicy;
