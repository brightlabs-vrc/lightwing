interface LoadingBoxProps {
  message: string
}

export function LoadingBox({ message }: LoadingBoxProps) {
  return (
    <div
      className="slds-box bg-white slds-align_absolute-center"
      style={{
        background: '#ffffff',
        borderRadius: '4px',
        border: '1px solid #dddbda',
        minHeight: '400px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <p className="slds-text-heading_small">{message}</p>
    </div>
  )
}
