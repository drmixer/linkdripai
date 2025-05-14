/**
 * Outreach Fallback Handler
 * 
 * This script modifies the outreach component to provide fallback options
 * when email is not available, allowing users to still reach out through
 * alternative methods.
 */

import { db } from "../server/db";
import { discoveredOpportunities } from "../shared/schema";
import { sql } from "drizzle-orm";
import * as fs from "fs";
import * as path from "path";

async function updateOutreachComponent() {
  console.log("Looking for existing outreach component...");
  
  // Find the component files that need updating
  let componentPath = "";
  const possiblePaths = [
    "client/src/components/EmailOpportunityForm.tsx",
    "client/src/components/OutreachForm.tsx",
    "client/src/components/ContactOpportunityForm.tsx"
  ];
  
  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {
        componentPath = p;
        break;
      }
    } catch (e) {
      // Path doesn't exist, try next one
    }
  }
  
  if (!componentPath) {
    console.log("Could not find outreach component. You'll need to implement the fallback logic in your outreach form component.");
    return;
  }
  
  console.log(`Found outreach component at: ${componentPath}`);
  
  // Read the current component code
  const componentCode = fs.readFileSync(componentPath, "utf8");
  
  // Check if the component already has fallback handling
  if (componentCode.includes("fallbackContact") || componentCode.includes("alternative contact")) {
    console.log("Outreach component already appears to have fallback handling.");
    return;
  }
  
  console.log("Updating outreach component with fallback handling...");
  
  // Split the file content by lines
  const lines = componentCode.split("\n");
  
  // Find the right spot to add our new code - look for the component function
  let componentStartIndex = -1;
  let stateDefinitionIndex = -1;
  let renderStartIndex = -1;
  let importsSectionEnd = -1;
  
  for (let i = 0; i < lines.length; i++) {
    // Find component function definition
    if (lines[i].includes("function") && lines[i].includes("(") && 
        (lines[i].includes("Email") || lines[i].includes("Outreach") || lines[i].includes("Contact"))) {
      componentStartIndex = i;
    }
    
    // Find state definitions
    if (lines[i].includes("useState") && componentStartIndex !== -1) {
      stateDefinitionIndex = i;
    }
    
    // Find return statement for rendering
    if (lines[i].includes("return") && lines[i].includes("(") && componentStartIndex !== -1) {
      renderStartIndex = i;
      break;
    }
    
    // Find the end of imports section
    if (lines[i].trim() === "" && i > 5 && lines[i-1].includes("import")) {
      importsSectionEnd = i;
    }
  }
  
  if (componentStartIndex === -1 || stateDefinitionIndex === -1 || renderStartIndex === -1) {
    console.log("Could not identify the structure of the outreach component.");
    return;
  }
  
  // Add the Alert import if not present
  if (!componentCode.includes("import { Alert")) {
    const importLine = "import { Alert, AlertDescription, AlertTitle } from \"@/components/ui/alert\";";
    lines.splice(importsSectionEnd, 0, importLine);
    lines.splice(importsSectionEnd + 1, 0, "");
  }
  
  // Add new state for tracking fallback mode
  const fallbackStateDefinition = "  const [showFallback, setShowFallback] = useState(false);";
  lines.splice(stateDefinitionIndex + 1, 0, fallbackStateDefinition);
  
  // Find the right spot to add the fallback logic
  let formSubmitIndex = -1;
  for (let i = componentStartIndex; i < renderStartIndex; i++) {
    if (lines[i].includes("submit") || lines[i].includes("onSubmit")) {
      formSubmitIndex = i;
      break;
    }
  }
  
  if (formSubmitIndex !== -1) {
    // Add logic to check for emails before submission
    const checkEmailsLogic = `
  // Check if the opportunity has email contacts before submission
  useEffect(() => {
    if (opportunity && opportunity.contactInfo) {
      let contactInfo;
      try {
        contactInfo = typeof opportunity.contactInfo === 'string' 
          ? JSON.parse(opportunity.contactInfo) 
          : opportunity.contactInfo;
          
        const hasEmails = contactInfo.emails && contactInfo.emails.length > 0;
        setShowFallback(!hasEmails);
      } catch (e) {
        console.error("Error parsing contact info:", e);
        setShowFallback(true);
      }
    }
  }, [opportunity]);`;
    
    lines.splice(formSubmitIndex - 1, 0, checkEmailsLogic);
  }
  
  // Find the right spot to add the fallback UI
  let formRenderIndex = -1;
  for (let i = renderStartIndex; i < lines.length; i++) {
    if (lines[i].includes("<form") || lines[i].includes("<Form")) {
      formRenderIndex = i;
      break;
    }
  }
  
  if (formRenderIndex !== -1) {
    // Add the fallback UI
    const fallbackUI = `
      {showFallback && (
        <Alert className="mb-6">
          <AlertTitle>No email address available</AlertTitle>
          <AlertDescription>
            {opportunity?.statusNote ? (
              <div dangerouslySetInnerHTML={{ __html: opportunity.statusNote }} />
            ) : (
              <div>
                This opportunity doesn't have a direct email contact. 
                {opportunity?.contactInfo && (
                  <div className="mt-2">
                    {typeof opportunity.contactInfo === 'string' ? (
                      (() => {
                        try {
                          const contactInfo = JSON.parse(opportunity.contactInfo);
                          return (
                            <>
                              {contactInfo.contactForms && contactInfo.contactForms.length > 0 && (
                                <div className="mt-1">
                                  <strong>Contact forms:</strong>
                                  <ul className="list-disc pl-6 mt-1">
                                    {contactInfo.contactForms.slice(0, 3).map((form, i) => (
                                      <li key={i}>
                                        <a href={form} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                          {form}
                                        </a>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {contactInfo.socialProfiles && contactInfo.socialProfiles.length > 0 && (
                                <div className="mt-1">
                                  <strong>Social profiles:</strong>
                                  <ul className="list-disc pl-6 mt-1">
                                    {contactInfo.socialProfiles.slice(0, 3).map((profile, i) => (
                                      <li key={i}>
                                        <a href={profile.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                          {profile.platform}: {profile.username}
                                        </a>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </>
                          );
                        } catch (e) {
                          return <div>Unable to parse contact information.</div>;
                        }
                      })()
                    ) : (
                      <>
                        {opportunity.contactInfo.contactForms && opportunity.contactInfo.contactForms.length > 0 && (
                          <div className="mt-1">
                            <strong>Contact forms:</strong>
                            <ul className="list-disc pl-6 mt-1">
                              {opportunity.contactInfo.contactForms.slice(0, 3).map((form, i) => (
                                <li key={i}>
                                  <a href={form} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                    {form}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {opportunity.contactInfo.socialProfiles && opportunity.contactInfo.socialProfiles.length > 0 && (
                          <div className="mt-1">
                            <strong>Social profiles:</strong>
                            <ul className="list-disc pl-6 mt-1">
                              {opportunity.contactInfo.socialProfiles.slice(0, 3).map((profile, i) => (
                                <li key={i}>
                                  <a href={profile.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                    {profile.platform}: {profile.username}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}`;
    
    lines.splice(formRenderIndex, 0, fallbackUI);
  }
  
  // Write the updated component back to file
  const updatedCode = lines.join("\n");
  fs.writeFileSync(componentPath, updatedCode, "utf8");
  
  console.log(`Updated outreach component with fallback handling: ${componentPath}`);
}

// Run the function
updateOutreachComponent().catch(console.error);