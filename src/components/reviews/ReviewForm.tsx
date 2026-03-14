interface ReviewFormProps {
  projectId: string;
  freelancerUserId: string;
  onReviewSubmitted?: () => void;
  [key: string]: any;
}

export function ReviewForm(props: ReviewFormProps) {
  return <div className="text-sm text-muted-foreground">Review form placeholder</div>;
}

export default ReviewForm;
