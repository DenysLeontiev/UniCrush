import { Photo } from "./photo.model";

export interface WorkerDepartment {
    id: string;
    longName: string;
    shortName: string;
    departmentUrl: string;
}

export interface Worker {
    id: string;
    fullName: string;
    position: string;
    personalPageUrl: string;
    numberOfLikes: number;
    numberOfDislikes: number;
    photo: Photo;
    numberOfComments: number;
    departments?: WorkerDepartment[];
}
