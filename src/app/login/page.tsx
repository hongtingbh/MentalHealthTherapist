import { LoginForm } from '@/components/login/login-form';
import { AppLogo } from '@/components/icons';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import Image from 'next/image';

const loginBg = PlaceHolderImages.find(p => p.id === 'login-background');

export default function LoginPage() {
  return (
    <div className="w-full lg:grid lg:min-h-[100vh] lg:grid-cols-2 xl:min-h-[100vh]">
      <div className="flex items-center justify-center py-12">
        <div className="mx-auto grid w-[350px] gap-6">
          <div className="grid gap-2 text-center">
            <div className="flex justify-center items-center gap-2 mb-4">
              <AppLogo className="w-8 h-8 text-primary" />
              <h1 className="text-3xl font-bold font-headline">Mental Health App</h1>
            </div>
            <p className="text-balance text-muted-foreground">
              Your space for reflection and growth.
            </p>
          </div>
          <LoginForm />
        </div>
      </div>
      <div className="hidden bg-muted lg:block">
        {loginBg && (
          <Image
            src={loginBg.imageUrl}
            alt="Calm meditation scene"
            data-ai-hint={loginBg.imageHint}
            width="1200"
            height="800"
            className="h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
          />
        )}
      </div>
    </div>
  );
}
