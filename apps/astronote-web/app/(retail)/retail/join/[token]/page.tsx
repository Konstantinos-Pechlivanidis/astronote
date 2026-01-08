import { redirect } from 'next/navigation';

type JoinRedirectProps = {
  params: {
    token: string;
  };
};

export default function RetailJoinRedirect({ params }: JoinRedirectProps) {
  redirect(`/join/${params.token}`);
}
