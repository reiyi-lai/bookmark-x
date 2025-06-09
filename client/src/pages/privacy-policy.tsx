// import React from "react";
// import { Button } from "../components/ui/button";
// import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicy() {
//   const goBack = () => {
//     window.history.back();
//   };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          {/* <Button
            variant="ghost"
            onClick={goBack}
            className="mb-4 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button> */}
          <h1 className="text-3xl font-bold text-foreground mb-2">Privacy Policy</h1>
          {/* <p className="text-gray-600 dark:text-gray-400">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p> */}
        </div>

        {/* Content */}
        <div className="prose prose-gray dark:prose-invert max-w-none">
          <div className="space-y-6">
            
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Introduction</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Bookmark-X is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our Chrome extension and web application. By using or accessing the Services in any manner ("TweetsMash"), you acknowledge that you accept the practices and policies outlined in this Privacy Policy
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Information We Collect</h2>
              <div className="space-y-3">
                <div>
                  <h3 className="font-medium text-foreground mb-2">Twitter/X Data</h3>
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                    Our extension collects publicly available Twitter/X bookmark data including:
                  </p>
                  <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 mt-2 space-y-1">
                    <li>Tweet content and URLs</li>
                    <li>Author names, usernames, and profile pictures</li>
                    <li>Tweet timestamps and media information</li>
                    <li>Your Twitter/X user ID and username</li>
                  </ul>
                </div>
                
                <div>
                  <h3 className="font-medium text-foreground mb-2">Usage Data</h3>
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                    We collect information about how you use our service, including category assignments and user preferences.
                  </p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">How We Use Your Information</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
                We use the collected information to:
              </p>
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1">
                <li>Organize and categorize your bookmarks using machine learning</li>
                <li>Provide search and filtering functionality</li>
                <li>Improve our categorization algorithms</li>
                <li>Ensure the security and functionality of our service</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Data Sharing</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
                We do not sell your personal information. We may share data only in the following circumstances:
              </p>
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1">
                <li>With your consent</li>
                <li>To comply with legal obligations</li>
                <li>To protect our rights and prevent fraud</li>
                <li>With service providers who assist in our operations (under strict confidentiality agreements)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Your Rights with respect to Your Data</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
                You have the right to:
              </p>
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-1">
                <li>Access your personal data</li>
                <li>Correct inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Object to data processing</li>
                <li>Data portability</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Updates to This Policy</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                We may update this Privacy Policy periodically and will notify you of significant changes through our extension or website.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">Contact Us</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                If you have questions about this Privacy Policy or our data practices, please contact us at:{" "}
                <a href="mailto:privacy@bookmark-x.com" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">
                  rylai0219@gmail.com.
                </a>
              </p>
            </section>

          </div>
        </div>
      </div>
    </div>
  );
} 