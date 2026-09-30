import { Avatar } from '@/components/avatar';
import Link from 'next/link';
import { Pencil, Globe, Lock, MapPin } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { PageTitle, Badge } from '@/components/ui';
import { format } from 'date-fns';
export const metadata = { title: 'My profile' };
export default async function Profile() {
  const user = await requireUser();
  return (
    <>
      <PageTitle
        title="My profile"
        description="Your place in the world of learning."
        action={
          <Link className="button secondary" href="/settings">
            <Pencil size={15} />
            Edit profile
          </Link>
        }
      />
      <section className="panel">
        <div className="profile-header">
          <Avatar large name={user.name ?? user.username} image={user.image} />
          <div>
            <h1>{user.name ?? user.username}</h1>
            <p className="muted">@{user.username}</p>
            <Badge color={user.publicProfile ? 'teal' : 'neutral'}>
              {user.publicProfile ? (
                <>
                  <Globe size={12} />
                  Public profile
                </>
              ) : (
                <>
                  <Lock size={12} />
                  Private profile
                </>
              )}
            </Badge>
          </div>
        </div>
        <p className="profile-bio">
          {user.bio || 'Tell your story. Add a bio in settings to share what you’re learning.'}
        </p>
        <div className="profile-links">
          {user.website && (
            <a href={user.website} target="_blank" rel="noopener noreferrer">
              Website
            </a>
          )}
          {user.githubUrl && (
            <a href={user.githubUrl} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
          )}
          {user.linkedinUrl && (
            <a href={user.linkedinUrl} target="_blank" rel="noopener noreferrer">
              LinkedIn
            </a>
          )}
        </div>
        {user.location && (
          <p className="muted" style={{ marginBottom: 12 }}>
            <MapPin size={14} style={{ display: 'inline' }} /> {user.location}
          </p>
        )}
        <p className="muted" style={{ fontSize: 12, marginBottom: 25 }}>
          Learning here since {format(user.createdAt, 'MMMM yyyy')}
        </p>
        {user.publicProfile ? (
          <Link className="button primary" href={'/u/' + user.username}>
            <Globe size={15} />
            View public profile
          </Link>
        ) : (
          <Link className="button secondary" href="/settings">
            Manage privacy settings
          </Link>
        )}
      </section>
    </>
  );
}
