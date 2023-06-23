import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Router } from '@angular/router';
import { XaferUser } from '../../../../types/user';
import firebase from 'firebase/compat/app';
import { EmailAuthProvider } from 'firebase/auth';
import { defer, Observable, of, Subject, TimeoutError } from 'rxjs';
import { catchError, filter, map, switchMap, take, timeout } from 'rxjs/operators';
import { AppError, fromError } from 'utils/error-utils';
import { getFirebaseAuthErrCode, With$Id } from 'utils/firebase-utils';
import { TranslocoService } from '@ngneat/transloco';
import { Destroy } from '@src/utils';
import { UserService } from '@src/app/services';


@Injectable()
export class AuthService {
    @Destroy()
    readonly destroy$: Subject<any>;

    constructor(
        private fireAuth: AngularFireAuth,
        private router: Router,
        private translocoService: TranslocoService,
        private userService: UserService,
    ) {
    }

    init() {
        // this.geCurrentUser$().pipe(
        //     map(user => user?.lang),
        //     distinctUntilChanged(),
        //     takeUntil(this.destroy$),
        // ).subscribe(lang => {
        //     console.log('AuthService.lang', lang);
        //     if (lang) {
        //         this.translocoService.setActiveLang(lang);
        //     }
        // });
    }

    public async logout(): Promise<void> {
        await this.fireAuth.signOut();
        await this.waitLogout()
    }

    async waitLogin(timeoutMs?: number) {
        let authUser$ = this.fireAuth.authState.pipe(
            filter<firebase.User>(Boolean),
        );
        if (timeoutMs !== undefined) {
            authUser$ = authUser$.pipe(
                timeout(timeoutMs),
                catchError(err => {
                    if (err instanceof TimeoutError) {
                        return of(null);
                    }
                    throw err;
                })
            )
        }
        return await authUser$.pipe(take(1)).toPromise();
    }

    async waitLogout(): Promise<void> {
        await this.fireAuth.authState.pipe(
            filter<null>(user => user === null),
            take(1)
        ).toPromise();
    }

    currentUserId$(): Observable<string | null> {
        return defer(() => this.fireAuth.currentUser).pipe(
            map(user => user?.uid || null),
        );
    }

    geCurrentUser$(): Observable<With$Id<XaferUser> | null> {
        return this.currentUserId$().pipe(
            take(1),
            switchMap(userId => {
                if (!userId) {
                    return of(null)
                }
                return this.userService.getUser$(userId);
            }),
        );
    }

    async login(email: string, psw: string) {
        try {
            const credentials = await this.fireAuth.signInWithEmailAndPassword(email, psw);
            const user = await this.userService.getUser$(credentials.user.uid).pipe(
                take(1),
                timeout(1000),
            ).toPromise();
            if (!user) {
                await this.fireAuth.signOut();
                await this.waitLogout();
                throw new AppError('User not found', 'errors.user-not-verified');
            }
        } catch (err) {
            if (err instanceof TimeoutError) {
                throw new AppError('Authentication timeout. Please retry', 'errors.firebase-auth.timeout');
            }
            throw fromError(err, getFirebaseAuthErrCode(err))
        }
    }

    async signUp(user: XaferUser, psw: string): Promise<void> {
        try {
            const authUser = await this.fireAuth.createUserWithEmailAndPassword(user.email, psw);
            await authUser.user.sendEmailVerification();
            await this.userService.createWithId(authUser.user.uid, user);
        } catch (err) {
            throw fromError(err, 'app.error.create-user')
        }
    }

    async getAuthToken(): Promise<string | null> {
        const currentUser = await this.fireAuth.currentUser;
        return currentUser ? currentUser.getIdToken() : null;
    }

    async deleteUser(): Promise<void> {
        try {
            const user = await this.fireAuth.currentUser;
            await user.delete();
        } catch (error) {
            throw fromError(error);
        }
    }

    async changePassword(email: string, currentPassword: string, newPassword: string): Promise<void> {
        console.log('AuthService.changePassword', email);
        try {
            const user = await this.fireAuth.user.pipe(take(1)).toPromise();
            const credential = EmailAuthProvider.credential(email, currentPassword);

            await user.reauthenticateWithCredential(credential);
            await user.updatePassword(newPassword);
        } catch (error) {
            throw fromError(error);
        }
    }
}
