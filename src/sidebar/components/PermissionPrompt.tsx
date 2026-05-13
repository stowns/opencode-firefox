interface PermissionData {
  id: string;
  type?: string;
  title?: string;
  patterns?: string[];
  metadata?: Record<string, unknown>;
}

interface PermissionPromptProps {
  permission: PermissionData | null;
  onRespond: (id: string, response: string) => void;
}

export default function PermissionPrompt({ permission, onRespond }: PermissionPromptProps) {
  if (!permission) return null;

  const toolType = permission.type || "";
  const title = permission.title || "Permission required";
  const metadata = permission.metadata || {};

  let detail = "";
  if (toolType === "bash" || toolType === "exec") {
    detail = (metadata.command as string) || (metadata.cmd as string) || "";
  } else if (toolType === "write" || toolType === "edit") {
    detail = (metadata.path as string) || (metadata.file as string) || "";
  } else if (toolType === "read") {
    detail = (metadata.path as string) || (metadata.file as string) || "";
  } else if (toolType === "external_directory") {
    const patterns = permission.patterns || [];
    detail = patterns.length > 0 ? patterns.join("\n") : "";
  } else {
    detail = JSON.stringify(metadata);
  }

  return (
    <div id="permission-prompt">
      <div className="permission-header">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 10.5a.75.75 0 110-1.5.75.75 0 010 1.5zM8.75 4.5v3.5a.75.75 0 01-1.5 0v-3.5a.75.75 0 011.5 0z" />
        </svg>
        <span>{title}</span>
      </div>
      {detail && (
        <code className="permission-detail">{detail}</code>
      )}
      <div className="permission-actions">
        <button className="allow" onClick={() => onRespond(permission.id, "once")}>Once</button>
        <button className="always" onClick={() => onRespond(permission.id, "always")}>Always</button>
        <button className="reject" onClick={() => onRespond(permission.id, "reject")}>Reject</button>
      </div>
    </div>
  );
}
