/** Fields lsdb attaches automatically to every table row (`timestamps: true` in the schema). */
export interface WithTimestamps {
  _id: string;
  _created_at: string;
  _updated_at: string;
}
