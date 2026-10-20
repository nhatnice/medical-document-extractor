export function ValidationErrorList({ errors }: { errors: string[] }) {
  if (errors.length === 0) {
    return <p className="ok">No validation errors.</p>
  }
  return (
    <ul className="errors">
      {errors.map((error, i) => (
        <li key={i}>{error}</li>
      ))}
    </ul>
  )
}
