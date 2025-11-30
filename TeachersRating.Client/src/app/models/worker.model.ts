import { Photo } from "./photo.model";

export interface Worker {
    id: string;
    fullName: string;
    position: string;
    personalPageUrl: string;
    numberOfLikes: number;
    numberOfDislikes: number;
    photo: Photo;
    numberOfComments: number;
}